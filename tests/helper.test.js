jest.mock('aws-sdk', () => ({
  STS: jest.fn().mockImplementation(() => {
    return {
      getCallerIdentity: jest.fn().mockImplementation(() => {
        return { promise: jest.fn().mockReturnValue({ Account: 'account' }) }
      })
    }
  }),
  S3: jest.fn().mockImplementation(() => {
    return {
      putBucketReplication: jest.fn().mockImplementation(() => {
        return { promise: jest.fn() }
      }),
      headBucket: jest.fn().mockImplementation(() => {
        return { promise: jest.fn() }
      })
    }
  }),
  IAM: jest.fn().mockImplementation(() => {
    return {
      createRole: jest.fn().mockImplementation(() => {
        return { promise: jest.fn() }
      }),
      putRolePolicy: jest.fn().mockImplementation(() => {
        return { promise: jest.fn() }
      })
    }
  })
}))

const helper = require('../src/helper')

const SERVICE_NAME = 'TEST-SERVICE'

test('test s3 replication with empty context', async () => {
  const replicationConfigMap = await helper.setupS3Replication(createServerlessContext(false, false))
  expect(replicationConfigMap).toEqual(new Map())
})

test('test single direction s3 replication', async () => {
  const replicationConfigMap = await helper.setupS3Replication(createServerlessContext(true, false))

  expect(replicationConfigMap.size).toBe(2)

  expect(replicationConfigMap.get('my-bucket-eu-west-1')).toEqual({
    region: 'eu-west-1',
    role: 'TEST-SERVICE-eu-west-1-my-bucket-eu-west-1-s3-rep-role',
    rules: [
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-eu-west-2',
        },
        Filter: {
          Prefix: ''
        },
        Priority: 0,
        Status: 'Enabled'
      },
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-sec-eu-west-1'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 1,
        Status: 'Enabled'
      }
    ],
    targetBucketConfigs: [
      { 'eu-west-2': 'my-bucket-eu-west-2' },
      { 'eu-west-1': 'my-bucket-sec-eu-west-1' }
    ]
  })

  expect(replicationConfigMap.get('my-bucket-eu-central-1')).toEqual({
    region: 'eu-central-1',
    role: 'TEST-SERVICE-eu-central-1-my-bucket-eu-central-1-s3-rep-role',
    rules: [
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-us-east-2'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 0,
        Status: 'Enabled'
      }
    ],
    targetBucketConfigs: [
      { 'us-east-2': 'my-bucket-us-east-2' }
    ]
  })
})

test('test bidirectional s3 replication', async () => {
  const replicationConfigMap = await helper.setupS3Replication(createServerlessContext(false, true,))

  expect(replicationConfigMap.size).toBe(3)

  expect(replicationConfigMap.get('my-bucket-eu-west-1')).toEqual({
    region: 'eu-west-1',
    role: 'TEST-SERVICE-eu-west-1-my-bucket-eu-west-1-s3-rep-role',
    rules: [
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-eu-central-1'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 0,
        Status: 'Enabled'
      },
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-us-east-1'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 1,
        Status: 'Enabled'
      }
    ],
    targetBucketConfigs: [
      { 'eu-central-1': 'my-bucket-eu-central-1' },
      { 'us-east-1': 'my-bucket-us-east-1' }
    ]
  })

  expect(replicationConfigMap.get('my-bucket-eu-central-1')).toEqual({
    region: 'eu-central-1',
    role: 'TEST-SERVICE-eu-central-1-my-bucket-eu-central-1-s3-rep-role',
    rules: [
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-eu-west-1'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 0,
        Status: 'Enabled'
      },
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-us-east-1'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 1,
        Status: 'Enabled'
      }
    ],
    targetBucketConfigs: [
      { 'eu-west-1': 'my-bucket-eu-west-1' },
      { 'us-east-1': 'my-bucket-us-east-1' }
    ]
  })

  expect(replicationConfigMap.get('my-bucket-us-east-1')).toEqual({
    region: 'us-east-1',
    role: 'TEST-SERVICE-us-east-1-my-bucket-us-east-1-s3-rep-role',
    rules: [
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-eu-west-1'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 0,
        Status: 'Enabled'
      },
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-eu-central-1'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 1,
        Status: 'Enabled'
      }
    ],
    targetBucketConfigs: [
      { 'eu-west-1': 'my-bucket-eu-west-1' },
      { 'eu-central-1': 'my-bucket-eu-central-1' }
    ]
  })
})

test('test hybrid model of single direction and bidirectional s3 replication', async () => {
  const replicationConfigMap = await helper.setupS3Replication(createServerlessContext(true, true))

  expect(replicationConfigMap.size).toBe(3)
  expect(replicationConfigMap.get('my-bucket-eu-west-1')).toEqual({
    region: 'eu-west-1',
    role: 'TEST-SERVICE-eu-west-1-my-bucket-eu-west-1-s3-rep-role',
    rules: [
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-eu-central-1'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 0,
        Status: 'Enabled'
      },
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-us-east-1'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 1,
        Status: 'Enabled'
      },
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-eu-west-2'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 2,
        Status: 'Enabled'
      },
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-sec-eu-west-1'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 3,
        Status: 'Enabled'
      }
    ],
    targetBucketConfigs: [
      { 'eu-central-1': 'my-bucket-eu-central-1' },
      { 'us-east-1': 'my-bucket-us-east-1' },
      { 'eu-west-2': 'my-bucket-eu-west-2' },
      { 'eu-west-1': 'my-bucket-sec-eu-west-1' }
    ]
  })

  expect(replicationConfigMap.get('my-bucket-eu-central-1')).toEqual({
    region: 'eu-central-1',
    role: 'TEST-SERVICE-eu-central-1-my-bucket-eu-central-1-s3-rep-role',
    rules: [
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-eu-west-1'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 0,
        Status: 'Enabled'
      },
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-us-east-1'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 1,
        Status: 'Enabled'
      },
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-us-east-2'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 2,
        Status: 'Enabled'
      }
    ],
    targetBucketConfigs: [
      { 'eu-west-1': 'my-bucket-eu-west-1' },
      { 'us-east-1': 'my-bucket-us-east-1' },
      { 'us-east-2': 'my-bucket-us-east-2' }
    ]
  })

  expect(replicationConfigMap.get('my-bucket-us-east-1')).toEqual({
    region: 'us-east-1',
    role: 'TEST-SERVICE-us-east-1-my-bucket-us-east-1-s3-rep-role',
    rules: [
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-eu-west-1'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 0,
        Status: 'Enabled'
      },
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-eu-central-1'
        },
        Filter: {
          Prefix: ''
        },
        Priority: 1,
        Status: 'Enabled'
      }
    ],
    targetBucketConfigs: [
      { 'eu-west-1': 'my-bucket-eu-west-1' },
      { 'eu-central-1': 'my-bucket-eu-central-1' }
    ]
  })
})

test('test replication role with prefix override', async () => {
  const prefix = 'my-prefix'
  const replicationConfigMap = await helper.setupS3Replication(createServerlessContext(true, false, prefix))

  expect(replicationConfigMap.size).toBe(2)

  expect(replicationConfigMap.get('my-bucket-eu-west-1').role).toEqual(`${prefix}-eu-west-1-s3-rep-role`)
  expect(replicationConfigMap.get('my-bucket-eu-central-1').role).toEqual(`${prefix}-eu-central-1-s3-rep-role`)
})

test('test with replication time control', async () => {
  const replicationConfigMap = await helper.setupS3Replication(createServerlessContext(true, false, undefined, true))

  expect(replicationConfigMap.size).toBe(2)

  expect(replicationConfigMap.get('my-bucket-eu-west-1')).toEqual({
    region: 'eu-west-1',
    role: 'TEST-SERVICE-eu-west-1-my-bucket-eu-west-1-s3-rep-role',
    rules: [
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-eu-west-2',
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

        },
        Filter: {
          Prefix: ''
        },
        Priority: 0,
        Status: 'Enabled'
      },
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-sec-eu-west-1',
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
        },
        Filter: {
          Prefix: ''
        },
        Priority: 1,
        Status: 'Enabled'
      }
    ],
    targetBucketConfigs: [
      { 'eu-west-2': 'my-bucket-eu-west-2' },
      { 'eu-west-1': 'my-bucket-sec-eu-west-1' }
    ]
  })

  expect(replicationConfigMap.get('my-bucket-eu-central-1')).toEqual({
    region: 'eu-central-1',
    role: 'TEST-SERVICE-eu-central-1-my-bucket-eu-central-1-s3-rep-role',
    rules: [
      {
        DeleteMarkerReplication: {
          Status: 'Enabled'
        },
        Destination: {
          Bucket: 'arn:aws:s3:::my-bucket-us-east-2',
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
        },
        Filter: {
          Prefix: ''
        },
        Priority: 0,
        Status: 'Enabled'
      }
    ],
    targetBucketConfigs: [
      { 'us-east-2': 'my-bucket-us-east-2' }
    ]
  })

})

function createServerlessContext (singleDirection, bidirectional, replicationRolePrefixOverride, withReplicationTimeControl) {
  return {
    service: {
      provider: {
        region: 'eu-west-1'
      },
      getServiceName: () => { return SERVICE_NAME },
      custom: {
        s3ReplicationPlugin: {
          singleDirectionReplication: singleDirection ? createSingleDirectionReplicationConfig() : undefined,
          bidirectionalReplicationBuckets: bidirectional ? createBidirectionalReplicationConfig() : undefined,
          replicationRolePrefixOverride,
          withReplicationTimeControl
        }
      }
    },
    cli: {
      log: (str) => {
        console.log(str)
      }
    },
    getProvider: () => ({
      getCredentials: () => {}
    })
  }
}

function createSingleDirectionReplicationConfig () {
  return [
    {
      sourceBucket: { 'eu-west-1': 'my-bucket-eu-west-1' },
      targetBuckets: [
        { 'eu-west-2': 'my-bucket-eu-west-2' },
        { 'eu-west-1': 'my-bucket-sec-eu-west-1' }
      ]
    },
    {
      sourceBucket: { 'eu-central-1': 'my-bucket-eu-central-1' },
      targetBuckets: [
        { 'us-east-2': 'my-bucket-us-east-2' }
      ]
    }
  ]
}

function createBidirectionalReplicationConfig () {
  return [
    { 'eu-west-1': 'my-bucket-eu-west-1' },
    { 'eu-central-1': 'my-bucket-eu-central-1' },
    { 'us-east-1': 'my-bucket-us-east-1' }
  ]
}
