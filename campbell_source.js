const {addQueryToUrl} = require('url-transformers');
const cron = require('node-cron');
const request = require('request-promise-native');

class CampbellSource {
    constructor(config, opts) {
        let self=this;
        self.config = config;

        self.name = self.config.name;
        opts = Object.assign({}, opts);

        /* Docs on the Campbell Scientific web API are in the help files for
         * CRBasic (windows app) which is included as part of the LoggerNet
         * software package */
        let query = {
            command: "DataQuery",
            uri: "dl:" + self.config.table,
            format: "json",
            mode: "most-recent",
            p1: "1"
        };

        self.url = addQueryToUrl({ url: self.config.host })( 
            {queryToAppend: query});

        /* check cron syntax rather than silently failing */
        if(!cron.validate(self.config.schedule)) {
            console.log("%s: cron syntax error", self.name);
            return;
        }

        cron.schedule(self.config.schedule, () => {
            self.fetchSync();
        });

        let setupPromises = [];

        /* if we have a chain client and a device URL, set up pushing to Chain */
        if(opts.chain !== undefined && self.config.chainDevice !== undefined) {
            setupPromises.push((async (chain, deviceURL) => {
                self.chainDevice = await chain.get(deviceURL);
                if(self.chainDevice === undefined) {
                    console.log("%s: warning: no such chain device", self.name);
                }
            })(opts.chain, self.config.chainDevice));
        }

        /* go ahead and perform an immediate fetch after setup is done; chain
         * will ignore the sample if it already exists (this mainly makes
         * development easier since you don't have to wait) */
        Promise.all(setupPromises).then(() => {
            console.log("%s: performing initial fetch", self.name);
            self.fetchSync();
        }).catch((err) => {
            console.log("%s: setup error: %s", self.name, err.toString());
        });
    }

    /* perform an update synchronously, printing some useful status */
    fetchSync() {
        let self=this;
        console.log("%s: starting update", self.name);
        self.update().then(() => {
            console.log("%s: update finished", self.name);
        }).catch((err) => {
            console.log("%s: update failed: %s", self.name, err.toString());
        });
    }

    /* method that fetches from the datalogger */
    async update() {
        let self=this;
        let responseStr = await request.get(self.url);
        let response = JSON.parse(responseStr);
  
        /* perform some basic sanity checking on the response */
        if(response.head === undefined || response.head.fields === undefined ||
          response.data === undefined || response.data.length < 1 ||
          response.data[0].time === undefined || 
          response.data[0].vals === undefined) {
            throw new Error("malformed response");
        }

        let vals = response.data[0].vals;
        let fields = response.head.fields;
        let time = response.data[0].time;
        if(self.config.tzOffset !== undefined) {
            time += self.config.tzOffset;
        }
        let timestamp = new Date(Date.parse(time)); 

        if(self.chainDevice !== undefined) {
            let sensors = await self.chainDevice.rel('ch:sensors');
            for(let i=0; i<vals.length; i++) {
                let meta = fields[i];
                let sensor = await sensors.search({title: meta.name});

                /* create sensors that don't yet exist */
                if(sensor === undefined) {
                    console.log("%s: creating sensor: %s", self.name, meta.name);
                    sensor = await sensors.create({
                        "sensor-type": "scalar",
                        metric: meta.name,
                        unit: meta.units
                    });
                }

                /* add the sample to the data history */
                let history = await sensor.rel('ch:dataHistory');
                let sample = await history.create({
                    timestamp,
                    value: vals[i]
                });
                console.log("%s: updated sensor %s", self.name, meta.name);
            }
        }
    }
}

module.exports = CampbellSource;
