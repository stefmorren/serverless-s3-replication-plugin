const chalk = require('chalk')
const aws = require('aws-sdk')

const S3_PREFIX = 'arn:aws:s3:::'
const TAG = 'SLS-S3-REPLICATION-PLUGIN'
const LOG_PREFIX = 'SLS-S3-REPLICATION-PLUGIN:'
const REPLICATION_ROLE_SUFFIX = 's3-rep-role'

function getCredentials (serverless) {
  const provider = serverless.getProvider('aws')
  return Object.assign({}, provider.getCredentials(), { region: provider.region })
}

async function getAccountId (serverless) {
  const sts = new aws.STS(getCredentials(serverless))
  const identity = await sts.getCallerIdentity().promise()
  return identity.Account
}

function getServiceName (serverless) {
  return serverless.service.getServiceName()
}

function getSingleDirectionReplicationConfigs (serverless) {
  return serverless.service.custom.s3ReplicationPlugin.singleDirectionReplication
}

function getBidirectionalReplicationBucketConfigs (serverless) {
  return serverless.service.custom.s3ReplicationPlugin.bidirectionalReplicationBuckets
}

async function setupS3Replication (serverless) {
  serverless.cli.log(`${LOG_PREFIX} Starting setting up the S3 Replication`)
  const replicationConfigMap = new Map()

  if (await allSpecifiedBucketsExist(serverless)) {
    if (getBidirectionalReplicationBucketConfigs(serverless)) {
      setupBidirectionalReplicationBuckets(serverless, replicationConfigMap)
    }

    if (getSingleDirectionReplicationConfigs(serverless)) {
      setupSingleDirectionReplication(serverless, replicationConfigMap)
    }

    await createReplicationRoleForEachBucket(serverless, replicationConfigMap)
    await putBucketReplicationsForReplicationConfigMap(serverless, replicationConfigMap)
  }
  serverless.cli.log(`${LOG_PREFIX} Finished S3 replication plugin`)

  return replicationConfigMap
}

function setupSingleDirectionReplication (serverless, replicationConfigMap) {
  serverless.cli.log('Starting setup of single direction replication')

  for (const singleDirectionReplicationConfig of getSingleDirectionReplicationConfigs(serverless)) {
    const sourceBucketConfig = singleDirectionReplicationConfig.sourceBucket
    const sourceBucket = getBucketName(sourceBucketConfig)
    const sourceRegion = getRegion(sourceBucketConfig)
    const targetBucketConfigs = singleDirectionReplicationConfig.targetBuckets

    setupReplicationConfigForSourceAndTargetBuckets(serverless, replicationConfigMap, sourceBucket, targetBucketConfigs, sourceRegion)
  }
}

function setupBidirectionalReplicationBuckets (serverless, replicationConfigMap) {
  serverless.cli.log(`${LOG_PREFIX} Starting setup of bidirectional replication buckets`)

  for (const sourceBucketConfig of getBidirectionalReplicationBucketConfigs(serverless)) {
    const sourceRegion = getRegion(sourceBucketConfig)
    const sourceBucket = getBucketName(sourceBucketConfig)

    const targetBucketConfigs = getBidirectionalReplicationBucketConfigs(serverless).filter(
      (bucket) => bucket !== sourceBucketConfig
    )

    setupReplicationConfigForSourceAndTargetBuckets(serverless, replicationConfigMap, sourceBucket, targetBucketConfigs, sourceRegion)
  }
}

function setupReplicationConfigForSourceAndTargetBuckets (serverless, replicationConfigMap, sourceBucket, targetBucketConfigs, sourceRegion) {
  let replicationConfigValueForSourceBucket = replicationConfigMap.get(
    sourceBucket
  )
  if (!replicationConfigValueForSourceBucket) {
    replicationConfigValueForSourceBucket = {
      rules: createS3RulesForBucket(serverless, sourceBucket, targetBucketConfigs),
      targetBucketConfigs,
      region: sourceRegion
    }

    replicationConfigMap.set(
      sourceBucket,
      replicationConfigValueForSourceBucket
    )
  } else {
    createS3RulesForBucket(serverless, sourceBucket, targetBucketConfigs, replicationConfigValueForSourceBucket.rules)
    replicationConfigValueForSourceBucket.targetBucketConfigs = replicationConfigValueForSourceBucket.targetBucketConfigs.concat(targetBucketConfigs)
  }
}

async function createOrUpdateS3ReplicationRole (
  serverless,
  sourceBucket,
  targetBucketConfigs,
  sourceRegion
) {
  const iam = new aws.IAM(getCredentials(serverless))

  const defaultRoleName = `${getServiceName(serverless)}-${sourceRegion}-${sourceBucket}-${REPLICATION_ROLE_SUFFIX}`
  const prefixOverride = serverless.service.custom.s3ReplicationPlugin.replicationRolePrefixOverride
  const roleName = prefixOverride ? `${prefixOverride}-${sourceRegion}-${REPLICATION_ROLE_SUFFIX}` : defaultRoleName

  const createRoleRequest = {
    RoleName: roleName,
    AssumeRolePolicyDocument: getAssumeRolePolicyDocument(),
    Tags: [{
      Key: TAG,
      Value: TAG
    }]
  }

  try {
    await iam.createRole(createRoleRequest).promise()
  } catch (e) {
    if (e.code !== 'EntityAlreadyExists') throw e
  }

  const putRolePolicyRequest = {
    RoleName: roleName,
    PolicyName: 's3-replication-policy',
    PolicyDocument: getPolicyDocument(sourceBucket, targetBucketConfigs)
  }

  await iam.putRolePolicy(putRolePolicyRequest).promise()

  return roleName
}

function getPolicyDocument (sourceBucket, targetBucketConfigs) {
  const targetBucketArns = []

  for (const targetBucketConfig of targetBucketConfigs) {
    targetBucketArns.push(
      `${S3_PREFIX}${getBucketName(targetBucketConfig)}/*`
    )
  }

  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['s3:GetReplicationConfiguration', 's3:ListBucket'],
        Resource: [`${S3_PREFIX}${sourceBucket}`]
      },
      {
        Effect: 'Allow',
        Action: [
          's3:GetObjectVersionForReplication',
          's3:GetObjectVersionAcl',
          's3:GetObjectVersionTagging'
        ],
        Resource: [`${S3_PREFIX}${sourceBucket}/*`]
      },
      {
        Effect: 'Allow',
        Action: [
          's3:ReplicateObject',
          's3:ReplicateDelete',
          's3:ReplicateTags'
        ],
        Resource: targetBucketArns
      }
    ]
  })
}

function getAssumeRolePolicyDocument () {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          Service: ['s3.amazonaws.com']
        },
        Action: ['sts:AssumeRole']
      }
    ]
  })
}

async function putBucketReplicationsForReplicationConfigMap (serverless, replicationConfigMap) {
  const s3 = new aws.S3(getCredentials(serverless))

  for (const sourceBucket of replicationConfigMap.keys()) {
    const sourceReplicationConfig = replicationConfigMap.get(sourceBucket)
    const s3BucketReplicationRequest = {
      Bucket: sourceBucket,
      ReplicationConfiguration: {
        Role: `arn:aws:iam::${await getAccountId(serverless)}:role/${sourceReplicationConfig.role}`,
        Rules: sourceReplicationConfig.rules
      }
    }

    await s3.putBucketReplication(s3BucketReplicationRequest).promise()
  }
}

async function createReplicationRoleForEachBucket (serverless, replicationConfigMap) {
  for (const sourceBucket of replicationConfigMap.keys()) {
    const sourceReplicationConfig = replicationConfigMap.get(sourceBucket)
    sourceReplicationConfig.role = await createOrUpdateS3ReplicationRole(serverless, sourceBucket, sourceReplicationConfig.targetBucketConfigs, sourceReplicationConfig.region)
    replicationConfigMap.set(sourceBucket, sourceReplicationConfig)
  }
}

function createS3RulesForBucket (serverless, sourceBucket, targetBucketConfigs, currentRules) {
  const rules = currentRules || []

  let counter = rules.length

  for (const targetBucketConfig of targetBucketConfigs) {
    const targetBucket = getBucketName(targetBucketConfig)
    rules.push({
      Destination: {
        Bucket: `${S3_PREFIX}${targetBucket}`,
        ...getReplicationTimeControl(serverless)
      },
      Status: 'Enabled',
      Priority: counter,
      Filter: {
        Prefix: ''
      },
      DeleteMarkerReplication: {
        Status: 'Enabled'
      }
    })

    counter++

    serverless.cli.log(`${LOG_PREFIX} Creating replication rule between ${chalk.green(sourceBucket)} and ${chalk.green(targetBucket)} S3 buckets`)
  }
  return rules
}

function getReplicationTimeControl (serverless) {
  return serverless.service.custom.s3ReplicationPlugin.withReplicationTimeControl ? {
    Metrics: {
      EventThreshold: {
        Minutes: 15
      },
      Status: 'Enabled'
    },
    ReplicationTime: {
      Status: 'Enabled',
      Time: {
        Minutes: 15
      }
    }
  } : {}
}

async function allSpecifiedBucketsExist (serverless) {
  let allBucketsExist = true

  if (getSingleDirectionReplicationConfigs(serverless)) {
    for (const singleDirectionReplicationConfig of getSingleDirectionReplicationConfigs(serverless)) {
      const sourceBucket = getBucketName(singleDirectionReplicationConfig.sourceBucket)
      if (!(await validateBucketExists(serverless, sourceBucket))) allBucketsExist = false

      for (const targetBucketConfig of singleDirectionReplicationConfig.targetBuckets) {
        const targetBucket = getBucketName(targetBucketConfig)
        if (!(await validateBucketExists(serverless, targetBucket))) allBucketsExist = false
      }
    }
  }

  if (getBidirectionalReplicationBucketConfigs(serverless)) {
    for (const targetBucketConfig of getBidirectionalReplicationBucketConfigs(serverless)) {
      const targetBucketName = getBucketName(targetBucketConfig)
      if (!(await validateBucketExists(serverless, targetBucketName))) allBucketsExist = false
    }
  }

  return allBucketsExist
}

async function validateBucketExists (serverless, bucketName) {
  const s3 = new aws.S3(getCredentials(serverless))

  try {
    await s3
      .headBucket({
        Bucket: bucketName,
        ExpectedBucketOwner: `${await getAccountId(serverless)}`
      })
      .promise()
  } catch (e) {
    if (e.code === 'NotFound' || e.code === 'BadRequest') {
      serverless.cli.log(`${LOG_PREFIX} ${chalk.red(`Bucket ${bucketName} does not exist yet. Plugin will only be executed when all buckets exist`)}`)

      return false
    }
    throw e
  }
  return true
}

function getBucketName (bucketConfig) {
  return Object.values(bucketConfig)[0]
}

function getRegion (bucketConfig) {
  return Object.keys(bucketConfig)[0]
}

module.exports = {
  setupS3Replication
}
