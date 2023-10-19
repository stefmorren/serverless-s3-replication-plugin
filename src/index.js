const helper = require('./helper')

class S3ReplicationPlugin {
  constructor (serverless, options) {
    this.serverless = serverless
    this.options = options

    this.hooks = {
      'after:deploy:deploy': () => helper.setupS3Replication(serverless)
    }

    const pluginSchema = {
      type: 'object',
      properties: {
        s3ReplicationPlugin: {
          type: 'object',
          properties: {
            singleDirectionReplication: { type: 'array' },
            bidirectionalReplicationBuckets: { type: 'array' },
            replicationRolePrefixOverride: { type: 'string' },
            withReplicationTimeControl: { type: 'boolean' }
          }
        }
      },
      required: ['s3ReplicationPlugin']
    }

    this.serverless.configSchemaHandler.defineCustomProperties(pluginSchema)
  }
}

module.exports = S3ReplicationPlugin
