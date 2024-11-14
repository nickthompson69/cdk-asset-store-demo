#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkAssetStoreDemoStack } from '../lib/cdk-asset-store-demo-stack';

const app = new cdk.App();
new CdkAssetStoreDemoStack(app, 'CdkAssetStoreDemoStack', {
  env: { account: 'xxxxxxx', region: 'xxxxxx' },
});