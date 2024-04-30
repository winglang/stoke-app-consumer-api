jest.setTimeout(120000);
process.env.AWS_REGION = process.env.awsRegion;
process.env.interactTalentSnsTopicArn = "arn:aws:sns:us-east-1:727244588241:dev-interact-talent-notifications";
if (!process.env.testRemote) {
    process.env.IS_OFFLINE = true;
    // process.env.testURL = "http://localhost:8000"
}