# gpsy

A GPS serial client. 

## Install

```
npm install gpsy
```

## Usage

``` javascript

var gpsy = require("gpsy");

var gps = gpsy("/dev/cu.SLAB_USBtoUART"); // your serial device

gps.on("fix", console.log);
gps.on("position", console.log);
gps.on("speed", console.log);
gps.on("time", console.log);

```

## License

[Public Domain](http://unlicense.org/UNLICENSE)