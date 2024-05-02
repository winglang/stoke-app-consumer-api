pub class Util {
  pub static stage(): str {
    return "dev";
  }

  pub static gsiItemsByCompanyIdIndexName(): str {
    return "gsiItemsByCompanyId_V2";
  }

  pub static gsiUsersByEntityIdIndexName(): str {
    return "gsiUsersByEntityId_V2";
  }

  pub static consumerAuthTableName(): str {
    return "{Util.stage()}-consumer-auth";
  }

  pub static customersTableName(): str {
    return "{Util.stage()}-customers";
  }
}