const CampbellSource = require('./campbell_source');
const {ChainClient} = require('chainclient');

class CampbellChain {
    constructor(configfile) {
        let self=this;
        self.config = require(configfile);

        self.chain = new ChainClient(self.config.chain);

        for(let sourceConfig of self.config.sources) {
            let source = new CampbellSource(sourceConfig, {chain: self.chain});
        }
    }
}

let cc = new CampbellChain("./config.json");
