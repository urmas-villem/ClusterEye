kubectl create namespace argocd && kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml               

kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d                                            

kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | powershell -Command "[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($input))"                                        
