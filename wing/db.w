bring cloud;
bring dynamodb;
bring util;
bring fs;
bring "./consts.w" as consts;

pub class Database {
  pub connection: dynamodb.Connection;
  new() {

    // let skillIds = new dynamodb.Table(
    //   name: "dev-skill-ids",
    //   attributes: [
    //     {
    //       name: "itemId",
    //       type: "S",
    //     },
    //   ],
    //   hashKey: "itemId",
    // ) as "dev-skill-ids";

    // // let jobSkillIds = new dynamodb.Table(
    // //   name: "job-skill-ids",
    // //   attributes: [
    // //     {
    // //       name: "itemStatus",
    // //       type: "S",
    // //     },
    // //     {
    // //       name: "itemId",
    // //       type: "S",
    // //     },
    // //   ],
    // //   hashKey: "itemStatus",
    // //   rangeKey: "itemId",
    // // ) as "dev-job-skill-ids";

    let consumerAuth = new dynamodb.Table(
      name: consts.consumerAuthTableName(),
      attributes: [
        {
          name: "userId",
          type: "S",
        },
        {
          name: "entityId",
          type: "S",
        },
        {
          name: "companyId",
          type: "S",
        },
      ],
      hashKey: "userId",
      rangeKey: "entityId",
      globalSecondaryIndex: [
        {
          name: "gsiItemsByCompanyId",
          hashKey: "companyId",
          projectionType: "INCLUDE",
          nonKeyAttributes: [
            "itemId",
            "entityId",
            "companyId",
            "createdAt",
            "modifiedAt",
            "createdBy",
            "modifiedBy",
            "itemStatus",
            "itemData",
            "userId",
            "itemScope",
          ],
          readCapacity: 1,
          writeCapacity: 1,
        },
        {
          name: "gsiUsersByEntityId",
          hashKey: "entityId",
          projectionType: "INCLUDE",
          nonKeyAttributes: [
            "userId",
            "companyId",
            "entityId",
            "itemData",
            "itemStatus",
            "modifiedAt",
            "createdAt",
            "itemScope",
            "itemId",
            "createdBy",
            "modifiedBy",
          ],
          readCapacity: 1,
          writeCapacity: 1,
        },
        {
          name: consts.gsiItemsByCompanyIdIndexName(),
          hashKey: "companyId",
          projectionType: "INCLUDE",
          nonKeyAttributes: [
            "itemId",
            "entityId",
            "companyId",
            "createdAt",
            "modifiedAt",
            "createdBy",
            "modifiedBy",
            "itemStatus",
            "itemData",
            "userId",
            "itemScope",
            "tags",
          ],
          readCapacity: 1,
          writeCapacity: 1,
        },
        {
          name: consts.gsiUsersByEntityIdIndexName(),
          hashKey: "entityId",
          projectionType: "INCLUDE",
          nonKeyAttributes: [
            "userId",
            "companyId",
            "entityId",
            "itemData",
            "itemStatus",
            "modifiedAt",
            "createdAt",
            "itemScope",
            "itemId",
            "createdBy",
            "modifiedBy",
            "tags",
          ],
          readCapacity: 1,
          writeCapacity: 1,
        },
      ],
    ) as consts.consumerAuthTableName();

    let customersTable = new dynamodb.Table(
      name: consts.customersTableName(),
      attributes: [
        {
          name: "companyId",
          type: "S",
        },
        {
          name: "itemId",
          type: "S",
        },
        {
          name: "userId",
          type: "S",
        },
        {
          name: "itemStatus",
          type: "S",
        },
      ],
      hashKey: "itemId",
      globalSecondaryIndex: [
        {
          name: "gsiItemByUserId",
          hashKey: "userId",
          rangeKey: "itemId",
          projectionType: "INCLUDE",
          nonKeyAttributes: [
            "itemStatus",
            "itemId",
            "itemData",
            "entityId",
            "userId",
            "modifiedAt",
            "companyId",
            "createdAt",
            "itemScope",
            "createdBy",
            "modifiedBy",
          ],
          readCapacity: 1,
          writeCapacity: 1,
        },
        {
          name: "gsiItemsByCompanyId",
          hashKey: "companyId",
          projectionType: "INCLUDE",
          nonKeyAttributes: [
            "itemId",
            "entityId",
            "companyId",
            "createdAt",
            "modifiedAt",
            "createdBy",
            "modifiedBy",
            "itemStatus",
            "itemData",
            "userId",
            "itemScope",
          ],
          readCapacity: 1,
          writeCapacity: 1,
        },
        {
          name: "gsiItemByItemStatus",
          hashKey: "itemStatus",
          rangeKey: "itemId",
          projectionType: "INCLUDE",
          nonKeyAttributes: [
            "itemId",
            "entityId",
            "companyId",
            "createdAt",
            "modifiedAt",
            "createdBy",
            "modifiedBy",
            "itemStatus",
            "itemData",
            "userId",
            "itemScope",
          ],
          readCapacity: 1,
          writeCapacity: 1,
        },
        {
          name: "gsiItemByUserId_V2",
          hashKey: "userId",
          rangeKey: "itemId",
          projectionType: "INCLUDE",
          nonKeyAttributes: [
            "itemStatus",
            "itemId",
            "itemData",
            "entityId",
            "userId",
            "modifiedAt",
            "companyId",
            "createdAt",
            "itemScope",
            "createdBy",
            "modifiedBy",
            "tags",
          ],
          readCapacity: 1,
          writeCapacity: 1,
        },
        {
          name: consts.gsiItemsByCompanyIdIndexName(),
          hashKey: "companyId",
          projectionType: "INCLUDE",
          nonKeyAttributes: [
            "itemId",
            "entityId",
            "companyId",
            "createdAt",
            "modifiedAt",
            "createdBy",
            "modifiedBy",
            "itemStatus",
            "itemData",
            "userId",
            "itemScope",
            "tags",
          ],
          readCapacity: 1,
          writeCapacity: 1,
        },
        {
          name: "gsiItemByItemStatus_V2",
          hashKey: "itemStatus",
          rangeKey: "itemId",
          projectionType: "INCLUDE",
          nonKeyAttributes: [
            "itemId",
            "entityId",
            "companyId",
            "createdAt",
            "modifiedAt",
            "createdBy",
            "modifiedBy",
            "itemStatus",
            "itemData",
            "userId",
            "itemScope",
            "tags",
          ],
          readCapacity: 1,
          writeCapacity: 1,
        },
        {
          name: "gsiItemByItemStatus_PrivateData",
          hashKey: "itemStatus",
          rangeKey: "itemId",
          projectionType: "INCLUDE",
          nonKeyAttributes: [
            "itemId",
            "entityId",
            "companyId",
            "createdAt",
            "modifiedAt",
            "createdBy",
            "modifiedBy",
            "itemStatus",
            "itemData",
            "userId",
            "itemScope",
            "tags",
            "itemPrivateData",
          ],
          readCapacity: 1,
          writeCapacity: 1,
        },
      ],
    ) as consts.customersTableName();

    let authSeed = fs.readJson("../seed/auth.json");
    let companiesSeed = fs.readJson("../seed/companies.json");
    new cloud.OnDeploy(inflight () => {
      for entry in Json.values(authSeed) {
        consumerAuth.put(Item: entry);
      }

      for entry in Json.values(companiesSeed) {
        customersTable.put(Item: entry);
      }
    });

    this.connection = consumerAuth.connection;
  }
}
