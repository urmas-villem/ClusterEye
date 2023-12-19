# ClusterEye

Checks images used by pods inside cluster and compares them with the newest versions. Notifies if necessary

#### Dockerhub link:
https://hub.docker.com/r/huxlee/jsapp/tags

#### Building and pushing to Dockerhub
Navigate inside https://github.com/urmas-villem/checker folder                                 
```docker build . -t huxlee/jsapp:v1.19```                            
```docker push  huxlee/jsapp:v1.19```                            
Edit deployment to use the new image                                  


#### Testing commands:
```             
kubectl run prometheus --image=prom/prometheus:v2.48.1 --port=9090 --labels="app=prometheus"                 
kubectl run alertmanager --image=prom/alertmanager:v0.26.0 --port=9093 --labels="app=alertmanager"   
kubectl run logstash-oss --image=docker.elastic.co/logstash/logstash-oss:8.11.3 --port=6173 --labels="app=logstash-oss"
```                           
