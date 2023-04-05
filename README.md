<div id="top"></div>
<!-- PROJECT LOGO -->
<br />
<div align="center">

  <img src="./.github/assets/logo.png#gh-light-mode-only" alt="Logo" width="300">
  <img src="./.github/assets/logo_dark.png#gh-dark-mode-only" alt="Logo" width="300">

  <h1>Executor Service</h1>

  <p>
    The Topos Executor Service executes cross-subnet messages on receiving subnets.
  </p>
</div>

## Prerequisites

### Redis

The Executor Service implements a queue pattern that leverages redis. To start the Executor Service, you will need to run a redis server in the background:

```
docker run -d --name redis-stack-server -p 6379:6379 redis/redis-stack-server:latest
```

### Environment

The Executor Service requires a local environment to be set up.

Create an `.env` at the root of the project, with the content of `.env.example`, and fill the revelant env var values.

```
AUTH0_AUDIENCE=
AUTH0_ISSUER_URL=
TOPOS_SUBNET_ENDPOINT=
SUBNET_REGISTRATOR_CONTRACT_ADDRESS=
TOPOS_CORE_CONTRACT_ADDRESS=
```

### Authentication (Auth0)

The Executor Service leverages [Auth0](https://auth0.com/) for machine-to-machine authentication and authorization. We use Auth0's machine-to-machine service as we are not authenticating/authorizing users but applications (e.g., dApp frontends) that will use the Executor Service as a call delegation for their users' cross-subnet messages.

```
users => dApp frontend ==call==> sending subnet
                       \=call==> executor service ==call==> receiving subnet
```

Any application calling the Executor Service must be registered on Auth0 as a new _Application_. Once authorized to use the Executor Service _API_, the relevant Auth0 client id and secret can be set within the execution environment of the calling application.

Regarding the Executor Service's execution environment (see [environment](#environment)), `AUTH0_AUDIENCE` and `AUTH0_ISSUER_URL` should be set with values provided in our documentation.

## Getting Started

Install NodeJS by following the guidelines from the [official NodeJS website](https://nodejs.dev/en/).

### Install Dependencies

To installation `npm` dependencies, run the following command:

```
npm i
```

### Run the Executor Service

To start an instance of the Executor Service, run the following command:

```
npm start
```

## License

This project is released under the terms of the MIT license.
