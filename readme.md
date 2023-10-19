# Serverless S3 replication plugin
[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
![Coverage Status](https://raw.githubusercontent.com/stefmorren/serverless-s3-replication-plugin/main/coverage/badge.svg?branch=master)

This is a serverless plugin to easily setup replications between AWS S3 buckets. The plugin allows you to set up single direction and/or bidirectional replication.

The plugin will wait until all buckets from the configuration exist. If they all succeed, the plugin will modify the configured S3 buckets and add replication to them. Also, the required IAM roles will automatically be created for you. The IAM role follows the best practice to only have the permissions to resources it really needs. There will be a unique IAM role in each region.   

## Install
`npm install --save-dev serverless-s3-replication-plugin`

## Usage
1. Configure the plugin in your `serverless.yml`

```yaml
plugins:
- serverless-s3-replication-plugin
```
2. Add the configuration for the plugin

2.1. Single direction replication example
```yaml
custom:
  s3ReplicationPlugin:
    singleDirectionReplication:
      - sourceBucket:
          eu-west-1: my-bucket-jlsadjklsd-eu-west-1
        targetBuckets:
          - eu-west-2: my-bucket-jlsadjklsd-eu-west-2
          - eu-west-1: my-bucket-jlsadjklsd-sec-eu-west-1
      - sourceBucket:
          eu-central-1: my-bucket-jlsadjklsd-eu-central-1
        targetBuckets:
          - eu-west-1: my-bucket-jlsadjklsd-eu-west-1
```

2.2. Bidirectional replication example
```yaml
custom:
  s3ReplicationPlugin:
    bidirectionalReplicationBuckets:
      - eu-west-1: my-bucket-jlsadjklsd-eu-west-1
      - eu-central-1: my-bucket-jlsadjklsd-eu-central-1
      - us-east-1: my-bucket-jlsadjklsd-us-east-1
```

2.3. Hybrid architecture with bidirectional and single direction replication
```yaml
custom:
  s3ReplicationPlugin:
    singleDirectionReplication:
      - sourceBucket: 
          eu-west-1: my-bucket-jlsadjklsd-eu-west-1
        targetBuckets: 
          - eu-west-2: my-bucket-jlsadjklsd-eu-west-2
          - eu-west-1: my-bucket-jlsadjklsd-sec-eu-west-1
      - sourceBucket: 
          eu-central-1: my-bucket-jlsadjklsd-eu-central-1
        targetBuckets: 
          - eu-west-1: my-bucket-jlsadjklsd-eu-west-1
    bidirectionalReplicationBuckets:
      - eu-west-1: my-bucket-jlsadjklsd-eu-west-1
      - eu-central-1: my-bucket-jlsadjklsd-eu-central-1
      - us-east-1: my-bucket-jlsadjklsd-us-east-1
```

## Overriding the S3 Replication Role name
The default value of the Replication Role is: `${serviceName}-${sourceRegion}-${sourceBucket}-s3-rep-role`. 
In most cases this default value will work without issue. But if your `serviceName` or `sourceBucket` are long, the cloudformation stack will fail with an error similar to:

```
Error:
ValidationError: 1 validation error detected: Value 'your-long-service-name-eu-west-1-your-long-s3-bucket-name-s3-rep-role' at 'roleName' failed to satisfy constraint: Member must have length less than or equal to 64
```

To resolve this issue, you can use the `replicationRolePrefixOverride` configuration to set a default prefix value, which will use the following format: `${replicationRolePrefixOverride}-${sourceRegion}-s3-rep-role`.

```yaml
custom:
  s3ReplicationPlugin:
    singleDirectionReplication:
      - sourceBucket:
          eu-west-1: my-bucket-jlsadjklsd-eu-west-1
        targetBuckets:
          - eu-west-2: my-bucket-jlsadjklsd-eu-west-2
          - eu-west-1: my-bucket-jlsadjklsd-sec-eu-west-1
    replicationRolePrefixOverride: "my-prefix"
```

This will result in the following replication role names:
- `my-prefix-eu-west-1-s3-rep-role`
- `my-prefix-eu-west-2-s3-rep-role`

## Setting Replication Time Control
The default value is disabled.
To enable it, you can use the `withReplicationTimeControl` configuration, set it to true to enable replication time control.

```yaml
custom:
  s3ReplicationPlugin:
    singleDirectionReplication:
      - sourceBucket:
          eu-west-1: my-bucket-jlsadjklsd-eu-west-1
        targetBuckets:
          - eu-west-2: my-bucket-jlsadjklsd-eu-west-2
          - eu-west-1: my-bucket-jlsadjklsd-sec-eu-west-1
    withReplicationTimeControl: true
```