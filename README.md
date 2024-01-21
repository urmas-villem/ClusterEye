# ClusterEye

Checks images used by pods inside cluster and compares them with the newest versions. Notifies if necessary

#### Dockerhub link:
https://hub.docker.com/r/huxlee/clustereye

#### Building and pushing to Dockerhub                           
```docker build . -t huxlee/clustereye:v1.0.0```                            
```docker push huxlee/clustereye:v1.0.0```                            
Edit deployment to use the new image                                  

#### Run the application on kubernetes
### Option 1
```   
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/clusterrole.yaml                 
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/clusterrolebinding.yaml                
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/configmap.yaml                
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/deployment.yaml                  
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/service.yaml                  
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/serviceaccount.yaml
```
### Option2
```   
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/clusterrole.yaml                 
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/clusterrolebinding.yaml                
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/configmap.yaml                
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/deployment.yaml                  
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/service.yaml                  
kubectl apply -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/serviceaccount.yaml
```
+
Testing commands:
```             
kubectl run prometheus --image=prom/prometheus:v2.48.1 --port=9090 --labels="app=prometheus"                 
kubectl run alertmanager --image=prom/alertmanager:v0.26.0 --port=9093 --labels="app=alertmanager"   
kubectl run logstash-oss --image=docker.elastic.co/logstash/logstash-oss:8.11.3 --port=6173 --labels="app=logstash-oss"
```
