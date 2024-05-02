bring cloud;
bring "./db.w" as db;
bring "./consts.w" as consts;

struct ApiHandlerContext {
  cognitoIdentityId: str;
  queryStringParameters: Map<str>;
}

struct ApiHandlerResponse {
  statusCode: num;
  headers: Map<str>;
  body: str;
}

struct ConsumerApiProps {
  db: db.Database;
}

class ConsumerApi {
  new(props: ConsumerApiProps) {
    let env = {
      "gsiItemsByCompanyIdIndexName":  consts.gsiItemsByCompanyIdIndexName(),
      "gsiUsersByEntityIdIndexName": consts.gsiUsersByEntityIdIndexName(),
      "consumerAuthTableName": consts.consumerAuthTableName(),
      "customersTableName": consts.customersTableName(),
      "IS_OFFLINE": "true",
      "DYNAMODB_CONFIG": Json.stringify(props.db.connection.clientConfig),
    };

    let api = new cloud.Api();
    api.get("/dev/users", inflight (req) => {
      ConsumerApi.setEnv(env);

      let res = ConsumerApi.getUsersInEntity(
        cognitoIdentityId: "offlineContext_cognitoIdentityId", 
        queryStringParameters: req.query,
      );

      return {
        status: res.statusCode,
        body: res.body,
        headers: res.headers,
      };
    });
  }

  extern "../src/users.js" static inflight getUsersInEntity(context: ApiHandlerContext): ApiHandlerResponse;
  extern "./util.js" static inflight setEnv(env: Map<str>): void;
}

new ConsumerApi(db: new db.Database());
