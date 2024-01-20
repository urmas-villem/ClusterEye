[First install argocd CLI](https://argo-cd.readthedocs.io/en/stable/cli_installation/)

``` 
kubectl create namespace argocd && kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl patch svc argocd-server -n argocd -p "{\"spec\": {\"type\": \"LoadBalancer\"}}"                                                   
argocd admin initial-password -n argocd                                  
``` 
