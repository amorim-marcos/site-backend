const fs = require('fs')
const { restoreConfig } = require('./src/functions')
const strapi = require('strapi')

async function restore(){
    let migrationsPath = process.cwd() + "/migrations/configs"
    let configExportPath = migrationsPath
    const app = await strapi().load()

    try{
        await restoreConfig(app, 'permission', 'users-permissions', configExportPath + '/users-permissions_permission.json')     
        await restoreConfig(app, 'role', 'users-permissions', configExportPath + '/users-permisions_role.json')
        await restoreConfig(app, 'strapi::permission', null, configExportPath + '/strapi_permission.json')
        await restoreConfig(app, 'strapi::role', null, configExportPath + '/strapi_role.json')
        await restoreConfig(app, 'plugins::i18n.locale', null, configExportPath + '/i18nlocale.json')
        process.exit()
    }catch(e){
        console.log(e)
        process.exit(1)
    }
}

restore()
