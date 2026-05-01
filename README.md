<!-- Run Docker -->
docker build -t dcms-backend .



Kubernetes

create Secret from .pem file
cmd:  kubectl create secret generic dcms-private-key --from-file=private.pem=./private.pem 