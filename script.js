/**
 * This script conncts with MySQL and send the mail to users to make them aware that there are pending SOPs
 * for which the the test must be attended. Ideally the script can run in a nodejs environment. 
 * 
 */

var pool = require('./database');
var nodemailer = require('nodemailer');
var Mailgen = require('mailgen');
var fs = require('fs');
var striptags = require('striptags');
const {
  resolve
} = require('path');


//Create a nodemailer transport to send the mails
let transporter = nodemailer.createTransport({
  host: "172.168.0.130", //Change this if host ip is changed
  port: 25,
  secure: false,
  tls: {
    // do not fail on invalid certs
    rejectUnauthorized: false
  }
});


//Mailgen Configuration
var mailGenerator = new Mailgen({
  theme: 'default',
  product: {
    name: 'PITAS',
    link: 'http://kservices.advinus.com/pitas'
  }
});



exports.sendMailforPendingTests = async () => {

  // Get All active Training Matrix which are created till now. Please quesry for more details

  try {

    let nodeData = await getAllTrainingMatrixNodes();

    console.log(new Date().toLocaleString() + " all training list nodes retrieved");

    let proceed = nodeData.length > 0;

    if (!proceed) console.log(new Date().toLocaleString() + " No training matrix node found");

    if (proceed) {


      nodeData.forEach(async (v, i) => {

        let listData = await getAllTestListFromTestFieldAsArray([v.nid]);

        console.log(new Date().toLocaleString() + " retrieved node of " + v.nid);

        proceed = listData.length > 0;

        if (!proceed) console.log("No data found for " + v.nid);

        if (proceed) {

          let queryTitleLikeString = "";

          listData.forEach((v, i) => {
            queryTitleLikeString = queryTitleLikeString + "n.title LIKE '%" + v.field_sop_list_value.trim() + "%' OR ";
          });

          queryTitleLikeString = queryTitleLikeString.slice(0, -4);
          queryTitleLikeString = "(" + queryTitleLikeString + ")";

          let titleData = await getCurrentNodeOfTheTest(queryTitleLikeString);

          proceed = titleData.length > 0;

          if (!proceed) console.log("No data found");

          if (proceed) {

            let nodeIds = [];

            titleData.forEach((v, i) => {
              nodeIds.push(v.nid)
            });


            let testResults = await getTestResults(v.uid, nodeIds);

            proceed = testResults.length > 0;

            if (!proceed) console.log("No data found");

            if (proceed) {

              let testsPending = titleData.filter(item1 => {
                return !testResults.some(item2 => {
                  return item1.nid == item2.nid
                })
              })

              proceed = testsPending.length > 0

              if (!proceed) console.log("No tests pending to take found");

              if (proceed) {

                let mailTable = [];

                testsPending.forEach(element => {
                  mailTable.push({
                    'SOP': element.title,
                    'Title': striptags(element.body_value),
                    'Edition': element.field_quiz_edition_value,
                    'Implementation Date': element.field_quiz_doimplementation_value.split("T")[0]
                  })
                });

                let email = {
                  body: {
                    name: v.name,
                    signature: false,
                    table: [{
                        // Optionally, add a title to each table.
                        title: 'Pending SOP tests to be attended',
                        data: mailTable,
                        columns: {
                          // Optionally, customize the column widths
                          customWidth: {
                            SOP: '10%',
                            Title: '50%',
                            Edition: '10%',
                            'Implementation Date': '20%'
                          },
                        }
                      },

                    ],
                    intro: 'As per your training list, below SOP tests are due. Please make sure that you are attending  the SOP tests on time.',
                    action: {
                      instructions: 'To view the training matrix dashboard, please click below. Links will work only in intranet environment.',
                      button: {
                        color: '#576ead', // Optional action button color
                        text: 'View',
                        link: 'http://kservices.advinus.com/pitas/quiznodeview/' + v.nid
                      }
                    },
                  }
                };

                //Generate the mail with MailGen

                let emailBody = mailGenerator.generate(email);
                let sub = "Pending SOP tests";

                let message = {
                  from: "pitas@advinus.com",
                  to: v.mail,
                  subject: sub,
                  html: emailBody,
                };

                //Send mail with nodemailer

                await transporter.sendMail(message);
              }
            }
          }
        }
      })
    }
  } catch (error) {
    console.log(error);
  }

}



exports.sendMailAfterIssueDate = async () => {

  try {

    let publishedData = await getPublishedNodesOnIssueDateToSendMail();

    let proceed = publishedData.length > 0;

    if (!proceed) console.log(new Date().toLocaleString() + "- no data found to process");

    if (proceed) {



      publishedData.forEach(async (v, i) => {

        let userData = await getSOPListChoseMembersbySopName(v.title);

        proceed = userData.length > 0;

        if (!proceed) console.log("No users found for the SOP");

        if (proceed) {

          let sub = v.title + "-Edition: " + v.editon + " issued";

          let mailTable = [];

          mailTable.push({
            'SOP': v.title,
            'Title': striptags(v.description),
            'Edition': v.editon,
            'Issue Date': v.issue_date.split("T")[0],
            'Implementation Date': v.implementation_date.split("T")[0],
            'Read': '<a href="http://kservices.advinus.com/pitas/sites/default/files/sop/' + v.title + '_ED' + v.editon + '/mobile/">Read</a>',
            'Test': '<a href="http://kservices.advinus.com/pitas/node/' + v.nid + '">Take</a>'
          })


          let email = {
            body: {
              signature: false,
              table: [{
                  // Optionally, add a title to each table.
                  title: v.title + " issued",
                  data: mailTable,
                  columns: {
                    // Optionally, customize the column widths
                    customWidth: {
                      'SOP': '10%',
                      'Title': '40%',
                      'Edition': '10%',
                      'Issue Date': '10%',
                      'Implementation Date': '10%',
                      'Read': '10%',
                      'Test': '10%',
                    },
                  }
                },

              ],
              intro: 'A new edition has been issued for SOP ' + v.title + ' which was selected in your training list. Please complete the training ASAP.',

            },
          }



          userData.forEach(async (data, index) => {

         
            email.body.action = [{
              instructions: 'To vies the training list, please click below. Links will work only in intranet environment.',
              button: {
                color: '#576ead', // Optional action button color
                text: 'View',
                link: 'http://kservices.advinus.com/pitas/quiznodeview/' + data.nid
              }
            }]

            email.body.name = data.name ;
            email.body.title = email.body.greeting + " " + email.body.name

            let emailBody = mailGenerator.generate(email);

            let message = {
              from: "pitas@advinus.com",
              to: data.mail,
              subject: sub,
              html: emailBody,
            }

            await transporter.sendMail(message);

          });


        };




      })
    }

  } catch (error) {
    throw error
  }


}






async function getAllTrainingMatrixNodes() {

  const result = await pool.query('SELECT n.nid,n.uid,n.status,u.name,u.mail FROM node AS n LEFT JOIN users AS u ON n.uid = u.uid where type = ? and u.status = ?', ['sop_training_matrix', '1'])

  if (result[0].length < 1) {

    throw new Error('No results found');

  }

  return result;

}


async function getAllTrainingMatrixNodesWithSupervisor() {

  const result = await pool.query("SELECT n.nid,n.uid,n.status,u.name AS user_name,u.mail AS user_mail,hosuser.name AS hos_name, hosuser.uid AS hos_uid,hosuser.mail AS hos_mail FROM node AS n LEFT JOIN users AS u ON n.uid = u.uid LEFT JOIN field_data_field_cv_hos AS hos_field ON n.uid = hos_field.entity_id LEFT JOIN users AS hosuser ON hos_field.field_cv_hos_uid = hosuser.uid where type = ?  and u.status = ? and hos_field.entity_type = ?", ['sop_training_matrix', '1', 'user'])

  if (result[0].length < 1) {


    throw new Error('No results found');

  }

  return result;

}





async function getAllTestListFromTestFieldAsArray(array) {

  const result = await pool.query("SELECT entity_id,field_sop_list_value FROM field_data_field_sop_list where entity_id IN (?)", array)

  if (result[0].length < 1) {

    throw new Error('No results found');
  }

  return result;

}

async function getCurrentNodeOfTheTest(nodeTitles) {

  let query = "SELECT n.nid,n.title,fdb.body_value,fdfqd.field_quiz_doimplementation_value,fdfqe.field_quiz_edition_value FROM node AS n LEFT JOIN field_data_field_quiz_doimplementation AS fdfqd ON n.nid = fdfqd.entity_id LEFT JOIN field_data_field_quiz_edition AS fdfqe ON n.nid = fdfqe.entity_id LEFT JOIN field_data_body AS fdb ON n.nid = fdb.entity_id WHERE n.type='quiz' and n.status = '1' and fdfqd.field_quiz_doimplementation_value <= CURDATE() and " + nodeTitles + " ORDER BY n.title"


  const result = await pool.query(query)

  if (result[0].length < 1) {

    throw new Error('No results found');
  }

  return result;


}

async function getTestResults(uid, nidArrayValues) {

  const result = await pool.query("SELECT nid,uid,score FROM quiz_node_results AS qnr WHERE uid=? and nid IN (?) and score >= ?", [uid, nidArrayValues, '80'])

  if (result[0].length < 1) {

    throw new Error('No results found');
  }

  return result;

}

async function insertToMailLog(data) {

  const result = await pool.query("INSERT INTO maillog SET ?", data)

  if (result.length < 1) {
    throw new Error('No results found');
  }
  return result;
}


let getPublishedNodesOnIssueDateToSendMail = async () => {

  try {

    let q = "SELECT n.nid,n.title,fdb.body_value as description,fdfdi.field_date_of_issue_value as issue_date,fdfqd.field_quiz_doimplementation_value as implementation_date,fdfqe.field_quiz_edition_value as editon FROM `field_data_field_date_of_issue` as fdfdi left join node as n ON fdfdi.entity_id = n.nid LEFT JOIN field_data_body AS fdb ON n.nid = fdb.entity_id LEFT JOIN field_data_field_quiz_doimplementation AS fdfqd ON n.nid = fdfqd.entity_id LEFT JOIN field_data_field_quiz_edition AS fdfqe ON n.nid = fdfqe.entity_id where (n.type = 'quiz' and n.status = 1) and ((fdfdi.field_date_of_issue_value = DATE_FORMAT(CURRENT_DATE, '%Y-%m-%dT%T') OR (fdfdi.field_date_of_issue_value < DATE_FORMAT(CURRENT_DATE, '%Y-%m-%dT%T') and n.created > UNIX_TIMESTAMP(CURRENT_DATE))))"

    const result = await pool.query(q)
    return result

  } catch (error) {
    throw error;
  }

}


let getSOPListChoseMembersbySopName = async (string) => {

  try {

    let q = "SELECT u.mail,u.name,n.uid,n.nid FROM field_data_field_sop_list as fdfsl left join node as n on fdfsl.entity_id = n.nid LEFT JOIN users as u on n.uid = u.uid WHERE u.status = 1 and fdfsl.field_sop_list_value like ?";

    const result = await pool.query(q, string.trim() + "%")
    return result

  } catch (error) {
    throw error;
  }

}



/*




*/