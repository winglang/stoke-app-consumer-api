you can invoke the lambda with the params.json file with this command  
`sls invoke local -f startConsumerTalentChat -p __tests__/_invoke_params/params2.json > test.json`  
`sls invoke local -f jobListAttrs -p __tests__/_invoke_params/jobListAttrs.json > test.json`
keep in mind that if you send body params you need to ignore your parsing and destruct from the variable itself

```
const data = event.body;
// const data = JSON.parse(event.body);
```

this is an example for params file:

```
{
    "requestContext": {
        "identity": {
            "cognitoIdentityId": "us-east-1:77ed546c-3115-4eb8-94c9-82f9f547b0e0"
        }
    },
    "body":{
    "companyId": "BENESHf81f1020-c2d5-11eb-8c02-8b2c51cad23c",
    "jobId": "job_2b7f1d50-e574-11eb-bc8a-83dc71ad7a2f",
    "entityId": "RD8a95db10-ce7e-11eb-b058-b1fe934d5045"
    }
}
```
