# About GitHub Action CICD

You can test the CICD pipeline locally before pushing changes.

## Prerequisites
Docker installed and running

```bash

# install "act" tools
wget https://github.com/nektos/act/releases/latest/download/act_Linux_x86_64.tar.gz
tar xf act_Linux_x86_64.tar.gz
sudo mv act /usr/local/bin/

# ------------------------------------

cd SmallGoods-Competition-app

# Run specific workflow
act -W .github/workflows/ci.yml

# Run with verbose output for debugging
act -v

# Run specific job
act -j build

# List available workflows
act -l
```