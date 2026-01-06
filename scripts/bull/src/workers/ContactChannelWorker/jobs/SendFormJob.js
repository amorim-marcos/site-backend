const soap = require("soap");

async function SendFormJob(job, done) {
  const startTime = Date.now();
  console.log("[Bull] Job: Start processing job");
  console.log(`[Bull] Job ID: ${job.id}`);

  // Process URLs and Constants
  const wsdl = process.env.SE_WSDL_URL;
  const location = process.env.SE_WSDL_LOCATION;
  const authToken = process.env.SE_AUTH_TOKEN;
  const idprocess = process.env.SE_ID_PROCESS;
  const matsolic = process.env.SE_USER_ID;
  const activityID = process.env.SE_ACTIVITY_ID;

  // Form data
  const fcnome = job.data.name;
  const fcemail = job.data.email;
  const fcfone = job.data.phone;
  const fccidade = job.data.city;
  const fcuf = job.data.state;
  const fcempresa = job.data.company;
  const fcmensagem = job.data.message;

  // Strapi data
  const fccanal = job.data.channel;
  const fcpapelcanal = job.data.service_code;

  try {
    // Create SOAP client
    const soapStart = Date.now();
    console.log("[Bull] Creating SOAP client...");
    const client = await soap.createClientAsync(wsdl, {
      trace: 1,
      exceptons: 1,
      location: location,
    });
    console.log(`[Bull] SOAP client created in ${Date.now() - soapStart}ms`);
    job.progress(20);

    client.addHttpHeader("Authorization", authToken);

    // Step 1: newWorkflow
    const workflowStart = Date.now();
    console.log("[Bull] Calling newWorkflow...");
    const workflowData = await client.newWorkflowAsync({
      ProcessID: idprocess,
      WorkflowTitle: fcemail,
      UserID: matsolic,
    });
    console.log(
      `[Bull] newWorkflow completed in ${Date.now() - workflowStart}ms`
    );
    job.progress(40);

    if (workflowData) {
      const workflowID = workflowData[0].RecordID;
      console.log(`[Bull] WorkflowID created: ${workflowID}`);

      // Step 2: editEntityRecord
      const editStart = Date.now();
      console.log("[Bull] Calling editEntityRecord...");
      const editRecordData = await client.editEntityRecordAsync({
        WorkflowID: workflowID,
        EntityID: "pfaleconosco",
        EntityAttributeList: {
          EntityAttribute: [
            {
              EntityAttributeID: "fcnome",
              EntityAttributeValue: fcnome,
            },
            {
              EntityAttributeID: "fcemail",
              EntityAttributeValue: fcemail,
            },
            {
              EntityAttributeID: "fcmensagem",
              EntityAttributeValue: fcmensagem,
            },
            {
              EntityAttributeID: "fctelefone",
              EntityAttributeValue: fcfone,
            },
            {
              EntityAttributeID: "fcestado",
              EntityAttributeValue: fcuf,
            },
            {
              EntityAttributeID: "fcempresa",
              EntityAttributeValue: fcempresa,
            },
            {
              EntityAttributeID: "fccidade",
              EntityAttributeValue: fccidade,
            },
            {
              EntityAttributeID: "fccanal",
              EntityAttributeValue: fccanal,
            },
            {
              EntityAttributeID: "fcpapelcanal",
              EntityAttributeValue: fcpapelcanal,
            },
          ],
        },
      });
      console.log(
        `[Bull] editEntityRecord completed in ${Date.now() - editStart}ms`
      );
      console.log(
        `[Bull] editEntityRecord status: ${editRecordData[0].Status}`
      );
      job.progress(70);

      if (editRecordData[0].Status != "FAILURE") {
        // Step 3: executeActivity
        const activityStart = Date.now();
        console.log("[Bull] Calling executeActivity...");
        const activityData = await client.executeActivityAsync({
          WorkflowID: workflowID,
          ActivityID: activityID,
          ActionSequence: "1",
          UserID: matsolic,
        });
        console.log(
          `[Bull] executeActivity completed in ${Date.now() - activityStart}ms`
        );
        console.log(`[Bull] executeActivity status: ${activityData[0].Status}`);
        job.progress(100);

        if (activityData[0].Status != "FAILURE") {
          console.log(
            `[Bull] Job completed successfully in ${Date.now() - startTime}ms`
          );
          console.log(`[Bull] Final WorkflowID: ${workflowID}`);
          done(null, { workflowID: workflowID });
        } else {
          throw new Error(JSON.stringify(activityData[0]));
        }
      } else {
        throw new Error(JSON.stringify(editRecordData[0]));
      }
    } else {
      throw new Error("Something went wrong.");
    }
  } catch (error) {
    console.error(`[Bull] Job failed after ${Date.now() - startTime}ms`);
    console.error("[Bull] Error details:", error.message);
    done(error);
  }
}

module.exports = {
  SendFormJob,
};
