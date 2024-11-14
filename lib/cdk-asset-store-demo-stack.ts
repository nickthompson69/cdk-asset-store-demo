import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';

export class CdkAssetStoreDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // define domains for route53
    const domainName = "yourdomain.com";
    const assetDomain = "assets" + "." + domainName;

    // Get hosted zone for domain
    const hostedZone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: domainName })

    // Create a new SSL cert for the domain(s)
    const sslCert = new acm.Certificate(this, 'CdkAssetStoreDemoCertificate', {
      domainName: domainName,
      subjectAlternativeNames: ['*.' + domainName],
      validation: acm.CertificateValidation.fromDns(hostedZone)
    });

    // Add a removal policy for the certificate
    sslCert.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Create an S3 bucket to store the assets
    const assetBucket = new s3.Bucket(this, 'S3AssetProjectDemoBucket', {
      bucketName: 's3-asset-project-demo-bucket',
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
    });

    // Create a cloudfront CDN distribution for serving the s3 bucket content
    const CDNdistribution = new cloudfront.Distribution(this, 'CdkAssetStoreDemoCDN', {
      certificate: sslCert,
      domainNames: [assetDomain],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: new cloudfront_origins.S3Origin(assetBucket),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      }
    });

    // Create the A record for the asset store URL
    new route53.ARecord(this, 'CdkAssetStoreDemoARecord', {
      zone: hostedZone,
      recordName: assetDomain,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(CDNdistribution))
    })
  }; 
};