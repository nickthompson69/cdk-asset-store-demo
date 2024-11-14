### Create an Asset Store with a Custom Domain using Amazon CDK, Route53, S3 and CloudFront ###

Creating a scalable asset store with Amazon S3, CloudFront, and adding your own custom domain using Route53 is more straightforward that it might appear and is a highly effective solution for serving assets to your applications. 

This guide helps you setup and configure these AWS services which reliably stores your files within AWS S3 (Simple Storage Service) distributes your assets globally using a CloudFront CDN which, improves load times by having cached edge copies of your assets to your users local regions, and ensures secure access through HTTPS and added security benefits provided by having your files behind the CDN.

### What can you host in AWS S3?

- Images
- Fonts
- Videos
- Files - S3 can store almost any type of data in most formats. JSON, Text, XML etc

> *Note that this guide configures your asset store for public access, make sure any files stored in S3 are OK for public view, always be careful!*

### Prerequisites

To get started with this guide you will need the following
- AWS account with full Admin access
- AWS CDK installed and a basic understanding of how to create a new application. 
See [Getting Started with CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) and [Create Your First CDK App](https://docs.aws.amazon.com/cdk/v2/guide/hello_world.html) for more info
- Recent versions of Node.js and TypeScript Installed
- A custom domain already registered and verified with AWS Route53

### Step 1: Create your CDK application

Make a new directory for the project and cd into the folder
``` $ mkdir cdk-yourprojectname ```  
``` $ cd cdk-yourprojectname ```  
From the new directory create a new CDK application
``` $ cdk init app --language typescript ```  
The CDK stack is now created and can be accessed from 
``` lib/cdk-yourprojectname-stack.ts ```  
Make sure your local AWS environment is configured and bootstrapped as per the recommended steps in this guide [Getting Started with CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html)

### Step 2: Set Up an S3 Bucket for Your Assets

In this step we will import the **aws-s3** module from the AWS CDK library so we can create a new instance of the construct for our S3 Bucket

In your project-stack.ts file import the aws-s3 module at the top of file using
```js 
import * as s3 from 'aws-cdk-lib/aws-s3' 
```

Within the constructor of your main cdk.Stack class we can add the constructs we require for creating our AWS services, we will use the L2 construct for S3 to create a new S3 bucket to store our files.

When we create the new construct it takes in 3 arguments.
- A reference to the stack class (usually "this")
- A name for the AWS resource to be created, this is usually appended with the stack name within the AWS console but it makes sense to call it something we can easily identify. 
- An optional {object} parameter which provides a list of attributes used to configure the construct.

More information on the parameters for S3 can be found [here](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3-readme.html).  
We are using a set of sensible defaults in this example.

```js 
// Create an S3 bucket to store the assets
const assetBucket = new s3.Bucket(this, 'S3AssetProjectBucket', {
  bucketName: 's3-asset-project-bucket',
  publicReadAccess: true,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
  accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
});
```

### Step 3: Configure Your Domain and SSL certificates (DNS Settings)

To use a custom domain, we need to create new DNS record within Route 53 and create an SSL certificate which we we later use with CloudFront to enable secure HTTPS access to the S3 bucket.

First lets declare some variables we can use for the certificates and cloudfront.

```js
// define domains for route53
const domainName = "yourdomain.com";
const assetDomain = "assets" + "." + domainName;
```

CloudFront only verifies certificates issued in the **us-east-1** region so depending on your local region and where you plan to deploy your stack, this effects our approach to setting up SSL certificates.

**Option 1** Deploy the entire stack to the us-east-1 region. This means we can generate the SSL certificate as part of the main stack and use it with cloudfront without any additional configuration.

**Option 2** If you still plan to deploy to your local region, such as **eu-west-2** then the easiest option is to create the certificate manually using the AWS Console within the **us-east-1** region and reference that certificate within the CDK stack.

Lets take a look at configuring both options below:-

### Option 1 - Deploy in the US region ###

As we will be defining a new certificate using the Amazon Certificate Manager construct along with using Route53 we first need to import them from the CDK library, as before with the S3 bucket add these imports to the top of your stack.ts file
```js
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as route53 from 'aws-cdk-lib/aws-route53'
```

We can now create a variable which stores the hosted zone for your domain, this construct gets the information by looking up the Zone and domain name from the account specified in the region in the core app stack {env: params}

```js
// Get hosted zone for domain
const hostedZone = route53.HostedZone.fromLookup(this, 'Zone', {
  domainName: domainName 
});
```

Now we have the hosted zone we can create a new certificate using the AWS Certificate Manager and the Certificate construct passing the parameters for the domain name and create a wildcard using "*" to allow for this certificate to be used with any sub-domain in the future.

We pass in the hosted zone so that AWS can verify we own the domain before creating the certificate. *This process can take a few minutes to process and validate when deploying the stack*

```js
// Create a new SSL cert for the entire domain
const sslCert = new acm.Certificate(this, 'YourProjectSiteCertificate', {
  domainName: domainName,
  subjectAlternativeNames: ['*.' + domainName],
  validation: acm.CertificateValidation.fromDns(hostedZone)
});
```

Finally we add a removal policy to the certificate so when we tear down the CDK stack the certificate is also removed

```js
// Add a removal policy for the certificate
sslCert.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
```

### Option 2 - Create a manual certificate in the US region ###

As we are manually creating the certificate we will need to login to the main AWS console. As an admin user with the correct permissions to create resources using [AWS Certificate Manager](https://docs.aws.amazon.com/acm/latest/userguide/acm-overview.html) login and follow the steps below to create the certificate. It's important to make sure you create the certificate for both your main domain and a wildcard as this is what we will be using to setup the asset store (assets.yourdomain.com). As the domain is hosted within AWS route53 we can validate the certificate using DNS.

**Creating the certificate**
- Open AWS Certificate Manager Console: Go to AWS Certificate Manager (ACM) and ensure you're in the **us-east-1 region**
- Select Request a certificate. > Choose Request a public certificate > click Next.
- Specify Domain Names > Enter the domain name(s) for the certificate (e.g., yourdomain.com and *.yourdomain.com for wildcard) > Click Next.
- Select Validation Method > Choose DNS Validation (preferred as you control DNS in Route 53)
- Review your settings and request the certificate.

Once the certificate has been verified and is available to view in the console. We need to note down the certificate ARN (Amazon Resource Name) so we can use it within the CDK app. To get this make sure you're in the correct **us-east-1** region and then click on your certificate. Locate the ARN at the top of the page and copy the ARN data which should look something like this **arn:aws:acm:{region}:{accountid}:certificate/{certificateid}**

Now we have the ARN we can create a new variable with the CDK app using the certificate construct to create a reference to that certificate based on the ARN.

In your CDK stack add the following lines of code

```js
const usSSLCertArn = "Your ARN here"

const UsSSLCert = acm.Certificate.fromCertificateArn(
  this,
  'YourChosenCertConfigName',
  usSSLCertArn
);
```
Finally we need to enable a setting within the core CDK application to allow cross region resources. In your core app file located ``` bin/yourproject.ts ``` add the following line to the stack app options to enable cross region resource support. **crossRegionReferences: true**

```js
const app = new cdk.App();
new YourAppStack(app, 'YourAppStack', {
  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  env: { account: 'xxxxxxxx', region: 'xxxxxx' },
  crossRegionReferences: true,
});
```

### Step 3: Set Up CloudFront for Content Delivery

Using Amazon CloudFront as a CDN will help cache and serve your assets efficiently worldwide, reducing load times for your users. It also protects against DoS service attacks and protects you from occurring high usage costs from malicious attacks such as a [denial of wallet attack](https://academic.oup.com/cybersecurity/article/10/1/tyae004/7634012)

As with the previous constructs we need to import a few modules from the CDK library for CloudFront and Route53

```js
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
```

**Create a CloudFront Distribution**:
To create the CloudFront distribution we need to create a new instance of the construct and pass in our configuration and settings which we have created so far along with some default behaviors. More information on these parameters can be found [here](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront-readme.html)

```js
const CDNdistribution = new cloudfront.Distribution(this, 'YourProjectAssetCDN', {
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
```
   
**What have we configured?**:
 - **certificate** - Depending on the option you chose in the certificate section this will be the variable output from either Option1 (sslCert) or Option2 (UsSSLCert)
 - **domainNames** - We set this to the asset domain variable we declared earlier in the stack
 - **origin** - Here we added a reference to the S3 bucket we created so that when anyone accesses the domain this is the default content served via the CDN.
 - **Set Viewer Protocol Policy**: “Redirect HTTP to HTTPS” to ensure secure access to assets.

Finally we need to create the A record for the custom domain we plan to use for the asset store (assets.yourdomain.com) and pass in the CloudFront distribution as the target which we created in the previous step.

  ```js
    // Create the A record for the asset store URL
    new route53.ARecord(this, 'YourProjectAssetStore', {
      zone: hostedZone,
      recordName: assetDomain,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(CDNdistribution))
    })
  ```

### Step 4: Deploy and Test the Setup

Now you should have a complete stack configured that looks like this (assuming you opted for Option 1 in the certificate section):

```js
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';

export class YourAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // define domains for route53
    const domainName = "yourdomain.com";
    const assetDomain = "assets" + "." + domainName;

    // Get hosted zone for domain (Needs to have region set in the env param in the stack)
    const hostedZone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: domainName })

    // Create a new SSL cert for the entire domain
    const sslCert = new acm.Certificate(this, 'YourProjectSiteCertificate', {
      domainName: domainName,
      subjectAlternativeNames: ['*.' + domainName],
      validation: acm.CertificateValidation.fromDns(hostedZone)
    });

    // Add a removal policy for the cert
    sslCert.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Create an S3 bucket to store the assets
    const assetBucket = new s3.Bucket(this, 'S3AssetProjectBucket', {
      bucketName: 's3-asset-project-bucket',
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
    });

    // Create a cloudfront CDN distribution for serving the s3 bucket
    const CDNdistribution = new cloudfront.Distribution(this, 'YourProjectAssetCDN', {
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
    new route53.ARecord(this, 'YourProjectAssetStore', {
      zone: hostedZone,
      recordName: assetDomain,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(CDNdistribution))
    })
  }; 
};
```

**Test your stack configuration before deployment**
You can use the command cdk-synth to test how the real deployment will perform and this will report any issues such as misconfigurations or incompatible settings etc. 

Run the command in your terminal ```$ cdk-synth``` and agree to any prompts make sure to review the output file for any errors. Assuming there are no errors, proceed to the next step.

**Deploy the stack**
Now we have confirmed that the stack is going to deploy successfully we should be able to deploy our stack with confidence. To deploy run ```$ cdk-deploy``` and agree to any prompts etc.

**Upload Your Assets**:
You can now upload files (images, fonts, videos, CSS etc.) to the S3 bucket either through the AWS console, CLI, or SDK.

Once your CloudFront distribution is deployed and DNS is propagated, you should be able to access your assets via `https://assets.yourdomain.com/path-to-your-asset`.

### Congratulations! ###

You have now successfully created your asset store using your own domain which sits behind a globally distributed network.

**Lets review what we built:**
- We created a custom SSL certificate using AWS Certificate Manager
- Setup a custom domain assets.yourdomain.com using Route53
- Configured an object storage bucket using Amazon S3
- Securely Distributed the content using Amazon CloudFront

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
