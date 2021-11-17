const { dumpConfig } = require('./src/functions')

function dump(){
    dumpConfig('permission', 'users-permissions', './output.json')
}

dump()
process.exit()