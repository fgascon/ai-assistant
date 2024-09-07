import * as cdk from "aws-cdk-lib";
import { InfraStack } from "./infra-stack";

const app = new cdk.App();
new InfraStack(app, "InfraStack");
