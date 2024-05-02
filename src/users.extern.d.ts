export default interface extern {
  getUsersInEntity: (context: ApiHandlerContext) => Promise<ApiHandlerResponse>,
}
export interface ApiHandlerContext {
  readonly cognitoIdentityId: string;
  readonly queryStringParameters: Readonly<Record<string, string>>;
}
export interface ApiHandlerResponse {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly statusCode: number;
}