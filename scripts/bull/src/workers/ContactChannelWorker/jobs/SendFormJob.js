const soap = require('soap')

async function SendFormJob(job, done) {
    console.log("[Bull] Job: Start processing job");

    // Process URLs and Constants
    const wsdl = process.env.SE_WSDL_URL
    const location = process.env.SE_WSDL_LOCATION
    const authToken = process.env.SE_AUTH_TOKEN
    const idprocess = process.env.SE_ID_PROCESS
    const matsolic = process.env.SE_USER_ID
    const activityID = process.env.SE_ACTIVITY_ID

    // Form data
    const fcnome = job.data.name
    const fcemail = job.data.mail
    const fcfone = job.data.phone
    const fccidade = job.data.city
    const fcuf = job.data.state
    const fcempresa = job.data.company
    const fcmensagem = job.data.message

    // Strapi data
    const fccanal = job.data.channel;
    const fcpapelcanal = job.data.service_code;

    const client = await soap.createClientAsync(wsdl, {
        "trace": 1,
        "exceptons": 1,
        "location": location
    })

    client.addHttpHeader("Authorization", authToken)
    
    const workflowData = await client.newWorkflowAsync({
        "ProcessID": idprocess,
        "WorkflowTitle": fcemail,
        "UserID": matsolic
    })

    if(workflowData){
        const workflowID = return1[0].RecordID

        const editRecordData = await client.editEntityRecordAsync({
            "WorkflowID": workflowID,
            "EntityID": "pfaleconosco",
            "EntityAttributeList": {
                "EntityAttribute": [
                    {
                        "EntityAttributeID": "fcnome",
                        "EntityAttributeValue": fcnome
                    },
                    {
                        "EntityAttributeID": "fcemail",
                        "EntityAttributeValue": fcemail
                    },
                    {
                        "EntityAttributeID": "fcmensagem",
                        "EntityAttributeValue": fcmensagem
                    },
                    {
                        "EntityAttributeID": "fctelefone",
                        "EntityAttributeValue": fcfone
                    },
                    {
                        "EntityAttributeID": "fcestado",
                        "EntityAttributeValue": fcuf
                    },
                    {
                        "EntityAttributeID": "fcempresa",
                        "EntityAttributeValue": fcempresa
                    },
                    {
                        "EntityAttributeID": "fccidade",
                        "EntityAttributeValue": fccidade
                    },
                    {
                        "EntityAttributeID": "fccanal",
                        "EntityAttributeValue": fccanal
                    },
                    {
                        "EntityAttributeID": "fcpapelcanal",
                        "EntityAttributeValue": fcpapelcanal
                    }
                ]
            }
        })

        if(editRecordData[0].Status != 'FAILURE'){
            //Executa Atividade do Solicitante
            const activityData = await client.executeActivityAsync({
                "WorkflowID": workflowID,
                "ActivityID": activityID,
                "ActionSequence": '1',
                'UserID': matsolic
            })

            if(activityData[0].Status != 'FAILURE'){
                done(null, { message: "Everything is fine."})
            }else{
                throw new Error(activityData[0])
            }
        }else{
            throw new Error(editRecordData[0])
        }
    }else{
        throw new Error("Something went wrong.")
    }
}

module.exports = {
    SendFormJob
}