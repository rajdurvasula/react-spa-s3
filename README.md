# SPA-S3-CF CDK TypeScript project

This is a project for CDK development with TypeScript.

## Purpose
This Project demonstrates a Sample React Web App with content from S3 Bucket files served on AWS CloudFront distribution

## Associated React Web App Project
- Clone Git Repo: [react-cors-spa](https://github.com/aws-samples/react-cors-spa)
- Follow instructions [here](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/deploy-a-react-based-single-page-application-to-amazon-s3-and-cloudfront.html)

## Prerequisites
- Must be deployed to AWS Region: `us-east-1`
- Generate a valid CA-certified Certificate and upload to AWS Certificate Manager
- This Project uses `Context variables` in file: `cdk.context.json`
- Certificate DNS Name must match `Context varables`:
  - `domainName`
  - `siteSubDomain`

## Resources
Following resources are created by this Project:

- S3 Bucket (`your.domain.name`)
  - Files copied from this project to S3 Bucket
- API Gateway Endpoint
  - API Stage
  - API Deployment

## Provision
- Deploy this Project:

```
cdk deploy --require-approval=never
```

## Deprovision
- Delete this Project:

```
cdk destroy
```

## Test
- Once deployed, update `src/App.js` with API Endpoint
  - Refer to `Outputs` of this deployment
  - URL Pattern sample below:
```
https://jys4mlt9gc.execute-api.us-east-1.amazonaws.com/prod/hello
```

- Open CloudFront Distribution in browser (sample below)

```
https://d2nbu2yp2n97cc.cloudfront.net/
```

- Make changes to `index.html` and upload the file to S3 Bucket
- Ensure you run `Invalidation` on CloudFront Distribution to invalidate the cache
- Refresh the CloudFront Distribution URL on browser
  - Updated content should be displayed in browser

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
