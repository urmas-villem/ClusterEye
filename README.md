# ClusterEye

Checks images used by pods inside cluster and compares them with the newest versions. Notifies if necessary

#### Dockerhub link:
https://hub.docker.com/r/huxlee/clustereye   

#### Run the application on kubernetes
### Deployment option 1
## Prerequisites:
- [ArgoCD cli](https://argo-cd.readthedocs.io/en/stable/cli_installation/)
- [Helm](https://helm.sh/docs/intro/install/)
                                                                                
Run this command in a powershell window.     
```   
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/ArgoCD/setup.ps1").Content
```
This will:                                              
- setup argocd (on localhost:81)
- setup jenkins(with all of the prerequisites and the pipeline job already configured) on (localhost:8080)
- setup the ClusterEye application (on localhost)
- setup some dummy applications so Clustereye has something to check otherwise the input is empty

### Deployment option 2
```   
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/clusterrole.yaml                 
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/clusterrolebinding.yaml                
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/configmap.yaml                
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/deployment.yaml                  
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/service.yaml                  
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/serviceaccount.yaml
```
And add the commands for creating test pods
```             
kubectl run prometheus --image=prom/prometheus:v2.48.1 --port=9090 --labels="app=prometheus"                 
kubectl run alertmanager --image=prom/alertmanager:v0.26.0 --port=9093 --labels="app=alertmanager"   
kubectl run logstash-oss --image=docker.elastic.co/logstash/logstash-oss:8.11.3 --port=6173 --labels="app=logstash-oss"
```
