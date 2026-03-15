const POWERFORM_URL = 'https://na4.docusign.net/Member/PowerFormSigning.aspx?PowerFormId=5ee20754-3f68-4b20-8b36-3e215c9de4c4&env=na4&acct=dc1f5450-1e6f-4584-a16c-5448a5756942&v=2';

export async function GET() {
  return Response.redirect(POWERFORM_URL, 302);
}
