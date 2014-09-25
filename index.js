#!/usr/bin/env node

var serialport = require("serialport");
var moment = require("moment");
var events = require("events");
var nmea = require("nmea");
var util = require("util");

function gpsy(device){
	
	if (!(this instanceof gpsy)) return new gpsy(device);
	
	var self = this;
	
	self._opened = false;
	
	self.port = new serialport.SerialPort(device, { baudrate: 4800, parser: serialport.parsers.readline(/[\r\n]+/) });

	self.port.on("open", function(){
		
		if (!self._opened) {
			self._opened = true;
			self.emit("open");
		}
		
		self.port.on('data', function(data) {
			
			if (typeof data !== "string" || data === "" || !data.match(/^\$.+\*[0-9A-F]{2}$/)) return;
			
			try {
				var data = nmea.parse(data);
			} catch(e) {
				self.emit("err", e);
				return;
			}
			
			// emit raw data
			self.emit("data", data);

			// handle 
			self._handle(data);

		});
		
	});

	self.port.on("error", function(err){
		self.emit("error", err);
	});

	self.port.on("close", function(){
		if (self._opened) {
			self._opened = false;
			self.emit("close");
		}
	});
	
	return self;
	
};

util.inherits(gpsy, events.EventEmitter);

// convert from nmea speed to km/h
gpsy.prototype._parsespeed = function(s){
	return (parseFloat(s)*1.852); 
};

// convert from nmea date
gpsy.prototype._parsedate = function(d,t){
	return moment(d+t+"Z", "DDMMYYHHmmss.SSSZ");
};

// convert from nmea coordinates
gpsy.prototype._parsell = function(l,p){
	return parseFloat(l.replace(/^([0-9]+)([0-9]{2}\.[0-9]+)$/, function(l,h,m,o,s){
		return ((parseInt(h,10)+(parseFloat(m)/60))*((p==="S"||p==="W")?-1:1)).toFixed(5);
	}));
};

gpsy.prototype._handle = function(data) {
	var self = this;
	
	// emit raw data package
	self.emit("data", data);
	
	switch (data.type) {
		case "track-info": 
		
			// speed
			if (data.hasOwnProperty("speedKmph")) self.emit("speed", {
				speed: data.speedKmph,
				t: (new Date().valueOf())
			})
			else if (data.hasOwnProperty("speedKnots")) self.emit("speed", {
				speed: self._parsespeed(data.speedKnots),
				t: (new Date().valueOf())
			});

		break;
		case "nav-info":

			// date
			if (data.hasOwnProperty("date") && data.hasOwnProperty("timestamp")) self.emit("time", {
				time: self._parsedate(data.date, data.timestamp).valueOf(),
				t: (new Date().valueOf())
			});

			if (data.status === "valid") {

				// position
				if (data.hasOwnProperty("lat") && data.hasOwnProperty("lon")) self.emit("position", {
					lat: self._parsell(data.lat, data.latPole),
					lon: self._parsell(data.lon, data.lonPole),
					t: (new Date().valueOf())
				});
				
				// speed
				if (data.hasOwnProperty("speedKmph")) self.emit("speed", {
					speed: data.speedKmph,
					t: (new Date().valueOf())
				})
				else if (data.hasOwnProperty("speedKnots")) self.emit("speed", {
					speed: self._parsespeed(data.speedKnots),
					t: (new Date().valueOf())
				});
				
			}
		break;
		case "fix": 
			self.emit("fix", {
				type: data.fixType, 
				num: data.numSat,
				t: (new Date()).valueOf()
			});
			if (["fix","delta","pps","rtk","frtk"].indexOf(data.fixType) >= 0) {
				self.emit("position", {
					lat: self._parsell(data.lat, data.latPole),
					lon: self._parsell(data.lon, data.lonPole),
					t: (new Date()).valueOf()
				});
			}
		return;
		case "satellite-list-partial": break;
		case "active-satellites": break;
		default:
			console.log(data);
		break;
	}
};

module.exports = gpsy;
