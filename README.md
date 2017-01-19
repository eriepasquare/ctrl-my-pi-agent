## Control My Raspberry Pi - Agent


### About

This nodejs app exposes a REST API that controls the state of the GPIO pins on a Raspberry Pi.  It secures the REST endpoint using SSL Client-Authentication compliments of [this blog post](http://www.gettingcirrius.com/2012/06/securing-nodejs-and-express-with-ssl.html) by [Richard](https://www.blogger.com/profile/06198124983518126356), and [this example app](https://github.com/nategood/node-auth) by [nategood](https://github.com/nategood).  

It is intended to be used in conjunction with [ctrl-my-pi-app](https://github.com/eriepasquare/ctrl-my-pi-app) which can be hosted "offboard" the Raspberry Pi, and provides a user interface that interacts with this REST API via secured SSL Client-Authentication.

### REST API

* __Protocol:__ HTTPS (only)
* __Method:__ GET
* __Endpoint:__ /agent/{mode}/{id}/{action}

#### Parameters
* __mode:__ specifies if you are referencing the physical pin numbers (1-40) or the Broadcom (BCM/GPIO) pin numbers (0-27)
* __id:__ specifies what pin [0-40] or group of pins [all|odd|even] you are trying to control
* __action:__ specifies what action to take on the pin(s) identified by {id}

| Name |Location|Required|Values|
|------|--------|--------|------|
|mode  |path    |yes     |pin &#124; gpio |
|id    |path    |yes     |all &#124; odd &#124; even &#124; [0-40] |
|action|path    |yes     |off &#124; on &#124; toggle &#124; status |

### <a name="prerequisites"></a>Prerequisites
* Install nodejs 4.6.x on the Raspberry Pi. The following commands were adapted from [this tutorial](http://thisdavej.com/upgrading-to-more-recent-versions-of-node-js-on-the-raspberry-pi/
) by Dave Johnson.
```sh
sudo apt update
sudo apt full-upgrade
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt install nodejs
node -v
```
* SSL Certificates generated for Client-Authentication (CA, server, & client)
 > [This tutorial](http://www.gettingcirrius.com/2012/06/automating-creation-of-certificate.html) provides detailed steps on generating all of the required certificates (even if you don't follow the steps for automation).  Store the passwords you create for each key in a safe place!  For this application you will need to copy to your Raspberry Pi the following files:
 > * ca.crt
 > * server.crt
 > * server.key 
 >
 > and you will need the following certificate for testing:
 > * client.p12

### Install

Create the following directory to hold your ssl certificates. Copy the 3 certificate files mentioned above (ca.crt, server.crt, server.key) to the newly created ssl directory.
```sh
mkdir ssl
```

Execute the following commands on the Raspberry Pi to install the agent.

```sh
git clone https://github.com/eriepasquare/ctrl-my-pi-agent.git
cd ctrl-my-pi-agent
npm install
```

### <a name="configure"></a>Configure

The following environment variables are required for the SSL Client Authentication to work correctly and their values must provide absolute paths to the certificates and key.
```sh
export SSL_CA_CERT=/path/to/ssl/ca.crt;
export SSL_SERVER_KEY_PP=<password>;
export SSL_SERVER_KEY=/path/to/ssl/server.key;
export SSL_SERVER_CERT=/path/to/ssl/server.crt;
```
If you wish to have the agent listen on a port other than 3000 you can set the following environment variable to override the default port:
```sh
export PORT=3001
```
You may wish to (optionally) create a custom environment script that  automatically sets the above env variables at startup.  Simply copy-and-paste the above export commands into a script located at:
```sh
/etc/profile.d/ctrl-my-pi-agent.sh
```

### Start

Run the agent application with the following command (from within the repo directory cloned above)
```sh
nohup node agent.js &
```

### Testing
Testing can get tricky because of the SSL Client-Authentication and the self signed Certificate Authority (ca.crt)...  As mentioned in the [Prerequisites](#prerequisites) section above, [the linked tutorial](http://www.gettingcirrius.com/2012/06/automating-creation-of-certificate.html) generates 3 certificates (CA, server, & client) but we have only used CA.crt and server.crt so far (in the [Configure](#configure) section).  In order to invoke the REST api, you will now need to provide the client certificate in the PKCS#12 format (client.p12).  

NOTE: when generating the server certificate signing request (server.csr) it is critical that you specify the Common Name as the IP address or hostname of your Raspberry Pi.
```
Common Name (e.g. server FQDN or YOUR name) []: myraspberrypi.com
```

If the Common Name you provided in the signing request is not routable on your local network, you can (for testing purposes) append the following entry to the file /etc/hosts (on the machine you will be testing from) where 192.168.1.x is the IP address of your Raspberry Pi:
```
192.168.1.x   myraspberrypi.com
```

With your hosts file modified, and your client.p12 certificate, you should be able to invoke the REST API using the following curl command (with the correct path, password, and hostname of course) to turn all of the enabled pins on:
```sh
curl -s --cert /path/to/ssl/client.p12:<client-key-password> https://myraspberrypi.com:3201/agent/pin/all/on
```
turn all enabled pins off:
```sh
curl -s --cert /path/to/ssl/client.p12:<client-key-password> https://myraspberrypi.com:3201/agent/pin/all/off
```
