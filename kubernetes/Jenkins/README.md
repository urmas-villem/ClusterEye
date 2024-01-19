helm repo add jenkinsci https://charts.jenkins.io                         
helm repo update                               

kubectl create ns jenkins                                                   

kubectl create secret docker-registry docker-credentials --docker-username= --docker-password= --docker-email=random@random.com --namespace jenkins                             

helm upgrade --install jenkins jenkinsci/jenkins -n jenkins -f https://raw.githubusercontent.com/urmas-villem/ClusterEye/main/kubernetes/Jenkins/values.yaml                               
