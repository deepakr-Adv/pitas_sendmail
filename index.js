var cron = require('node-cron');
var scripts = require('./script');








cron.schedule('30 8 * * Mon,Tue,Wed,Thu,Fri', () => {
    console.log("sendMailforPendingTests Cron ran");
  scripts.sendMailforPendingTests();
});


cron.schedule('59 22 * * *', () => {
    console.log("sendMailAfterIssueDate Cron ran");
    scripts.sendMailAfterIssueDate();
  
});