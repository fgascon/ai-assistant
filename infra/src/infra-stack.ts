import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { fileURLToPath } from "url";

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const fnc = new lambdaNodejs.NodejsFunction(this, "Assistant", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: fileURLToPath(
        new URL(
          "../../services/assistant/src/lambda-handler.ts",
          import.meta.url,
        ),
      ),
    });

    const fncUrl = fnc.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    new CfnOutput(this, "ServiceUrl", {
      value: fncUrl.url,
    });
  }
}
