# AWS Order Handler

Minimal Node.js + TypeScript project for AWS Lambda with a checkout handler and AWS SAM deployment files.

## Project Summary

This project is a minimal Node.js + TypeScript AWS Lambda service for a synchronous checkout flow, packaged for AWS SAM deployment and backed by unit tests. The main endpoint is `POST /v1/checkout`, where the handler validates the request, fetches catalog and pricing data, calculates totals, creates a pending order, creates an invoice, and initiates payment before returning a checkout response.

The code is organized by responsibility:

- `src/handler.ts` contains the Lambda entrypoint and checkout orchestration flow
- `src/checkout/types.ts` contains checkout domain and API types
- `src/checkout/services.ts` contains service contracts and stub integrations for catalog, pricing, order, invoice, and payment
- `src/shared/http.ts` contains shared HTTP helpers such as `HttpError`, `jsonResponse`, `handleHttpError`, and `enforceRoute`
- `template.yaml` and `samconfig.toml` provide AWS SAM deployment support

The project also includes a sample local API Gateway event in `events/checkout.json` and unit tests in `test/handler.test.ts`. The tests cover the success path, validation failures, route mismatch, and upstream payment failure.

## Prerequisites

- Node.js 20+
- npm
- AWS SAM CLI if you want to build and deploy with SAM
- AWS CLI configured if you want to deploy from the command line

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

The Lambda entry point is:

- Handler file: `dist/handler.js`
- Handler symbol: `handler`

Use `handler.handler` as the Lambda handler value in AWS.

The implemented endpoint is:

- `POST /v1/checkout`

## Run locally

```bash
npm start
```

This runs the handler with the sample API Gateway event in `events/checkout.json`.

## Create deployment ZIP

```bash
npm run package
```

This produces `lambda.zip` in the project root.

## Deploy with AWS CLI

Create the Lambda:

```bash
aws lambda create-function \
  --function-name aws-order-handler \
  --runtime nodejs20.x \
  --role arn:aws:iam::<account-id>:role/<lambda-execution-role> \
  --handler handler.handler \
  --zip-file fileb://lambda.zip
```

Update an existing Lambda:

```bash
aws lambda update-function-code \
  --function-name aws-order-handler \
  --zip-file fileb://lambda.zip
```

## Build with AWS SAM

```bash
sam build
```

## Deploy with AWS SAM

For the first deployment, run guided deploy:

```bash
sam deploy --guided
```

After that, you can use:

```bash
sam deploy
```

The SAM stack is defined in `template.yaml`. The default values in `samconfig.toml` can be adjusted for your AWS region, S3 bucket, and stack naming.
