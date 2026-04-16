#Strelnica project

This is my idea about a new web project:

- a reservation system for a sports club
- minimalistic on frontend: a home page with a calendar that can create time slots for booking a time on Strelnica, must support Slovak and Hungarian
 language. Admin page can manage everything. Client section - only invited and confirmed users can create bookings and edit their own data.
 Contact form. Must be very nice responsive on mobile, tablet - this is a must, the Strelnica will have a tablet instead of a physical book and desktop also.
- super safe on backend: only admin can create users and then invite them via a link. They must be verified (email, sms) only then granted access.
When booking is made, it must first check if the date and time are available, but must be fist confirmed by admin, and only then a confirmation email goes to user. Admin must receive a request by email and sms and be able to approve without needing to go 
through login - maybe a code that only he will know will be required when confirming or declining a reservation request. 
Admin can add info about membership fee being paid or not. User can see his payment status. No payment gate. Based on the confirmed date, the user will 
receive a notification 5 minutes ahead to confirm that he actually arrived. Then the booking time is counted to his shooting hours. Users and admin can see the statistics of shoowing hours spent per date ranges. User sees his own stats, admin sees all and even can export pdf of stats of members and can choose what to export (active memebers, paying ones or not paying, their hours spent, number of visits per periods).

So far I have been using next.js, hono with bun, nest.js, n8n, all self hosted on VPS via a self hosted Coolify service. For database I prefer postgres but mongo is also good. For emails simple titan email via smtp, for sms smstools.sk api service. n8n flows and webhooks.

Suggest the best tech stack. Consider the idea in general and in particular suggest if I might miss anything. Suggest what data will we store in db (a user will have to put his personal details, including zbrojny preukaz. Gdpr and trade rules must be confirmed - so need those subpages as well. 


