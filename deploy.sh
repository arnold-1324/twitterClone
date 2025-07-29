#!/bin/bash

# Exit on error
set -e

# Variables (edit as needed)
EC2_USER=ec2-user
EC2_HOST=your-ec2-public-dns.amazonaws.com
EC2_PATH=/home/ec2-user/twitterClone
S3_BUCKET=blobstoragespace
FRONTEND_BUILD_PATH=Frontend/dist

echo "Building frontend..."
npm install --prefix Frontend
npm run build --prefix Frontend

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null
then
    echo "Error: AWS CLI not found. Please install AWS CLI (https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) and configure it with 'aws configure'."
    exit 1
fi

echo "Syncing frontend build to S3..."
aws s3 sync $FRONTEND_BUILD_PATH s3://$S3_BUCKET/ --delete

echo "Uploading backend files to EC2..."
rsync -avz --exclude 'node_modules' --exclude 'Frontend/dist' . $EC2_USER@$EC2_HOST:$EC2_PATH

echo "Installing backend dependencies on EC2..."
ssh $EC2_USER@$EC2_HOST "cd $EC2_PATH && npm install"

echo "Restarting backend server on EC2..."
ssh $EC2_USER@$EC2_HOST "cd $EC2_PATH && pm2 restart server.js || pm2 start Backend/server.js --name twitterClone"

echo "Deployment complete!"
echo "Frontend is served from S3: https://$S3_BUCKET.s3.amazonaws.com/index.html"
echo "Backend is running on EC2: http://$EC2_HOST:5000/"
