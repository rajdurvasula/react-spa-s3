import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as cforigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as certmgr from 'aws-cdk-lib/aws-certificatemanager';
import * as route from 'aws-cdk-lib/aws-route53';
import * as routeTargets from 'aws-cdk-lib/aws-route53-targets';

function getUniqueId() {
  const dateStr = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${dateStr}-${randomStr}`
}

export class SpaS3CfStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // unique id
    const uniqueId = getUniqueId();

    const account = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // context variables
    const domainName = cdk.Stack.of(this).node.tryGetContext("domainName");
    const siteSubDomain = cdk.Stack.of(this).node.tryGetContext("siteSubDomain");
    const certificateArn = cdk.Stack.of(this).node.tryGetContext("certificateArn");

    const zone = route.HostedZone.fromLookup(this, 'rd-hostedzone', {
      domainName: domainName
    });
    const siteDomain = siteSubDomain+"."+domainName;
    const cfOAI = new cf.OriginAccessIdentity(this, 'cf-sample-oai', {
      comment: 'OAI for ${this.stackName}'
    });

    // RestAPI
    const simpleApi = new apigw.RestApi(this, 'simple-api', {
      cloudWatchRole: true,
      description: 'A simple CORS compliant API',
      endpointTypes: [ apigw.EndpointType.REGIONAL ]
    });

    const helloResource = simpleApi.root.addResource('hello');

    helloResource.addMethod('GET', new apigw.MockIntegration({
      integrationResponses: [
        {
          statusCode: '200',
          selectionPattern: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'"
          },
          responseTemplates: {
            'application/json': '{ "message": "Hello World!" }'
          }
        }
      ],
      requestTemplates: {
        'application/json': '{ "statusCode": 200 }'
      },
      passthroughBehavior: apigw.PassthroughBehavior.WHEN_NO_MATCH
    }), {
      authorizationType: apigw.AuthorizationType.NONE,
      apiKeyRequired: false,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          },
          responseModels: {
            'application/json': apigw.Model.EMPTY_MODEL
          }
        }
      ]
    });

    // Deployment
    const simpleApiDeploy = new apigw.Deployment(this, 'simple-api-deploy', {
      api: simpleApi
    });

    // Stage
    const simpleApiStageV1 = new apigw.Stage(this, 'simple-api-stage-v1', {
      deployment: simpleApiDeploy,
      stageName: 'v1'
    });


    // site bucket
    const siteBucket = new s3.Bucket(this, 'site-bucket', {
      bucketName: siteDomain,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // grant access to CloudFront Distribution
    siteBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: [
        's3:GetObject'
      ],
      resources: [
        siteBucket.arnForObjects('*')
      ],
      principals: [
        new iam.CanonicalUserPrincipal(cfOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)
      ]
    }));

    // Certificate from ACM
    const certificate = certmgr.Certificate.fromCertificateArn(this, 'my-cert', certificateArn);

    // CloudFront Distribution
    const distribution = new cf.Distribution(this, 'SiteDistribution', {
      certificate: certificate,
      defaultRootObject: 'index.html',
      domainNames: [ siteDomain ],
      minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 403,
          responsePagePath: '/error.html',
          ttl: cdk.Duration.minutes(30)
        }
      ],
      defaultBehavior: {
        origin: new cforigins.S3Origin(siteBucket, {
          originAccessIdentity: cfOAI
        }),
        compress: true,
        allowedMethods: cf.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      }
    });

    // Route53 A Record
    const aRecord = new route.ARecord(this, 'site-alias-record', {
      recordName: siteDomain,
      target: route.RecordTarget.fromAlias(new routeTargets.CloudFrontTarget(distribution)),
      zone
    });

    // Deploy site contents
    const siteDeploy = new s3deploy.BucketDeployment(this, 'deploy-site', {
      sources: [
        s3deploy.Source.asset('./site-contents')
      ],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: [ '/*' ]
    });

    // Outputs
    // value: `${simpleApi.url}${simpleApiStageV1.stageName}${helloResource.path}`
    const apiStage = new cdk.CfnOutput(this, 'api-stage-endpoint', {
      description: 'API Stage Endpoint',
      value: `${simpleApiStageV1.urlForPath('/hello')}`
    });
    const cfDistName = new cdk.CfnOutput(this, 'cf-dist-name', {
      description: 'CloudFront Distribution Name',
      value: distribution.domainName
    });
  }
}
