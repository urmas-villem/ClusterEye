{{- define "loki.nginxConfig" }}
worker_processes  10;  ## Default: 1
error_log  /dev/stderr;
pid        /tmp/nginx.pid;
worker_rlimit_nofile 8192;

events {
  worker_connections  4096;  ## Default: 1024
}

http {
  client_body_temp_path /tmp/client_temp;
  proxy_temp_path       /tmp/proxy_temp_path;
  fastcgi_temp_path     /tmp/fastcgi_temp;
  uwsgi_temp_path       /tmp/uwsgi_temp;
  scgi_temp_path        /tmp/scgi_temp;

  proxy_read_timeout    120;
  proxy_send_timeout    120;
  proxy_connect_timeout 120;

  proxy_http_version    1.1;

  default_type application/octet-stream;
  log_format   {{ .Values.gateway.nginxConfig.logFormat }}

  {{- if .Values.gateway.verboseLogging }}
  access_log   /dev/stderr  main;
  {{- else }}

  map $status $loggable {
    ~^[23]  0;
    default 1;
  }
  access_log   /dev/stderr  main  if=$loggable;
  {{- end }}

  sendfile     on;
  tcp_nopush   on;
  resolver {{ .Values.global.dnsService }}.{{ .Values.global.dnsNamespace }}.svc.{{ .Values.global.clusterDomain }}.;

  {{- with .Values.gateway.nginxConfig.httpSnippet }}
  {{- tpl . $ | nindent 2 }}
  {{- end }}

  server {
    listen             8080;
    listen             [::]:8080;

    {{- if .Values.gateway.basicAuth.enabled }}
    auth_basic           "Loki";
    auth_basic_user_file /etc/nginx/secrets/.htpasswd;
    {{- end }}

    location = / {
      return 200 'OK';
      auth_basic off;
    }

    {{- $backendHost := include "loki.backendFullname" .}}
    {{- $readHost := include "loki.readFullname" .}}
    {{- $writeHost := include "loki.writeFullname" .}}

    {{- if .Values.read.legacyReadTarget }}
    {{- $backendHost = include "loki.readFullname" . }}
    {{- end }}

    {{- if gt (int .Values.singleBinary.replicas) 0 }}
    {{- $backendHost = include "loki.singleBinaryFullname" . }}
    {{- $readHost = include "loki.singleBinaryFullname" .}}
    {{- $writeHost = include "loki.singleBinaryFullname" .}}
    {{- end }}

    {{- $writeUrl    := printf "http://%s.%s.svc.%s:3100" $writeHost   .Release.Namespace .Values.global.clusterDomain }}
    {{- $readUrl     := printf "http://%s.%s.svc.%s:3100" $readHost    .Release.Namespace .Values.global.clusterDomain }}
    {{- $backendUrl  := printf "http://%s.%s.svc.%s:3100" $backendHost .Release.Namespace .Values.global.clusterDomain }}

    {{- if .Values.gateway.nginxConfig.customWriteUrl }}
    {{- $writeUrl  = .Values.gateway.nginxConfig.customWriteUrl }}
    {{- end }}
    {{- if .Values.gateway.nginxConfig.customReadUrl }}
    {{- $readUrl = .Values.gateway.nginxConfig.customReadUrl }}
    {{- end }}
    {{- if .Values.gateway.nginxConfig.customBackendUrl }}
    {{- $backendUrl = .Values.gateway.nginxConfig.customBackendUrl }}
    {{- end }}


    # Distributor
    location = /api/prom/push {
      proxy_pass       {{ $writeUrl }}$request_uri;
    }
    location = /loki/api/v1/push {
      proxy_pass       {{ $writeUrl }}$request_uri;
    }
    location = /distributor/ring {
      proxy_pass       {{ $writeUrl }}$request_uri;
    }

    # Ingester
    location = /flush {
      proxy_pass       {{ $writeUrl }}$request_uri;
    }
    location ^~ /ingester/ {
      proxy_pass       {{ $writeUrl }}$request_uri;
    }
    location = /ingester {
      internal;        # to suppress 301
    }

    # Ring
    location = /ring {
      proxy_pass       {{ $writeUrl }}$request_uri;
    }

    # MemberListKV
    location = /memberlist {
      proxy_pass       {{ $writeUrl }}$request_uri;
    }


    # Ruler
    location = /ruler/ring {
      proxy_pass       {{ $backendUrl }}$request_uri;
    }
    location = /api/prom/rules {
      proxy_pass       {{ $backendUrl }}$request_uri;
    }
    location ^~ /api/prom/rules/ {
      proxy_pass       {{ $backendUrl }}$request_uri;
    }
    location = /loki/api/v1/rules {
      proxy_pass       {{ $backendUrl }}$request_uri;
    }
    location ^~ /loki/api/v1/rules/ {
      proxy_pass       {{ $backendUrl }}$request_uri;
    }
    location = /prometheus/api/v1/alerts {
      proxy_pass       {{ $backendUrl }}$request_uri;
    }
    location = /prometheus/api/v1/rules {
      proxy_pass       {{ $backendUrl }}$request_uri;
    }

    # Compactor
    location = /compactor/ring {
      proxy_pass       {{ $backendUrl }}$request_uri;
    }
    location = /loki/api/v1/delete {
      proxy_pass       {{ $backendUrl }}$request_uri;
    }
    location = /loki/api/v1/cache/generation_numbers {
      proxy_pass       {{ $backendUrl }}$request_uri;
    }

    # IndexGateway
    location = /indexgateway/ring {
      proxy_pass       {{ $backendUrl }}$request_uri;
    }

    # QueryScheduler
    location = /scheduler/ring {
      proxy_pass       {{ $backendUrl }}$request_uri;
    }

    # Config
    location = /config {
      proxy_pass       {{ $backendUrl }}$request_uri;
    }

    {{- if and .Values.enterprise.enabled .Values.enterprise.adminApi.enabled }}
    # Admin API
    location ^~ /admin/api/ {
      proxy_pass       {{ $backendUrl }}$request_uri;
    }
    location = /admin/api {
      internal;        # to suppress 301
    }
    {{- end }}


    # QueryFrontend, Querier
    location = /api/prom/tail {
      proxy_pass       {{ $readUrl }}$request_uri;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
    location = /loki/api/v1/tail {
      proxy_pass       {{ $readUrl }}$request_uri;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
    location ^~ /api/prom/ {
      proxy_pass       {{ $readUrl }}$request_uri;
    }
    location = /api/prom {
      internal;        # to suppress 301
    }
    location ^~ /loki/api/v1/ {
      proxy_pass       {{ $readUrl }}$request_uri;
    }
    location = /loki/api/v1 {
      internal;        # to suppress 301
    }


    {{- with .Values.gateway.nginxConfig.serverSnippet }}
    {{ . | nindent 4 }}
    {{- end }}
  }
}
{{- end }}