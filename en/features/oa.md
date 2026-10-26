---
description: 'Office requests for leave, travel, expenses, seal use and general forms, using the existing workflow, private attachments, basic mobile handling, with current-public and historical capability boundaries.'
---

# Office requests

The **Office** entry brings together leave, travel, expense claims, seal use and general requests. My requests, to-dos, handled tasks and CC use the existing [approval center](/en/features/workflow), with the same processes and status. Basic office requests need no DingTalk. Since v1.11.0, the public composition contains these requests, the existing approval center, required files/notices and basic mobile handling. Complete collaboration, meetings, knowledge, supplies, native attendance and office assistant application tools do not ship in that composition.

## Five request types

| Request | Contents | What approval means |
| --- | --- | --- |
| Leave | Type, start and end time, declared days, reason, attachments | Updates the existing leave record, preserving old data and process links |
| Travel | Destination, start and end time, reason, optional estimated cost, attachments | Updates the travel record; the owner's approved travel may be referenced by an expense claim |
| Expense claim | Reason, expense dates and categories, line amounts, attachments, optional travel reference | Updates the claim; **approval does not mean payment** |
| Seal use | Seal type, document name, purpose, copies, desired date, attachments | Marks the request approved; **approval does not mean the seal has been applied** |
| General | Published dynamic form fields and attachments | Saves a workflow instance and form snapshot, with field access per step |

Leave days are declared by the requester, without automatic shift, holiday or leave-balance calculations. Expenses support CNY only, with totals calculated by the server. Seal requests do not connect to a physical seal or electronic signing service.

## Check the processes before use

Initialization creates default published versions only for missing travel, expense, seal and general office models: the tenant's protected administrator role handles them; no available approver prevents submission; approving one's own request still requires an explicit action. Existing edits, disabled or deleted models and published settings are preserved.

**Leave keeps its existing sample process configuration**, including its original auto-approval when nobody is available and skipping self-approval. The four new models' defaults do not overwrite it. Review requester scope, approvers, missing-approver handling and self-approval before real business use.

Saving a fixed request, starting the process, binding attachments and setting its initial status share a transaction. Approval, rejection, cancellation and administrative termination update workflow and business status together; a failure rolls back the action.

## Submit, return and view

1. Choose a request type in **Office**, fill in the form and attachments, choose people required by the process and submit.
2. Use the approval center for your requests, to-dos, handled tasks and CC.
3. Only the owner may edit an unstarted draft or a request currently returned to their start task. Approved requests are read-only.
4. A conflict between devices requires refreshing the current task and deciding again. Approval writes are not replayed automatically.

Details are available to the requester, current or past handlers, CC recipients and authorized managers within data scope. Knowing an ID gives no access. Manager query permission cannot substitute for the current handler. Cross-tenant and invisible records return 404.

## Private attachments and notices

Fixed requests use private office attachments; general requests use private workflow attachments. Binding checks the tenant, uploader and existing use. An expense claim and all its lines share a maximum of 10 active attachments.

Downloading requires both business-record and field access. Being the uploader, root or a global file administrator does not itself grant access to business attachments. Hidden fields reveal neither metadata nor content; globally deleting a bound business file is blocked.

To-dos, outcomes, returns, CC, cancellation and reminders reuse inbox and email templates. Notices send after the business transaction commits; failed sends can retry. Email needs SMTP configuration; a missing address is recorded as skipped. Actual email delivery and S3 storage require deployment-specific acceptance checks.

## Read and handle on mobile

Mobile shows the full decision information for leave, travel, expenses and seal use. General forms follow current step field access. To-dos, handled tasks, my requests and CC share desktop data. Existing mobile leave submission, editing after return and dynamic-form submission remain available. **Creating or editing travel, expense and seal requests is done on desktop.**

Attachments open through an authenticated same-origin interface, limited to 20 MiB. Supported preview formats depend on the device. Failure to load decision information or attachments blocks a business decision with an explanation. See [Mobile](/en/features/mobile).

## Ask the assistant

::: info v1.10.0 historical capability
Office assistant application tools were publicly released in [v1.10.0](https://github.com/732124645/qiwu-vue-admin/tree/v1.10.0), but do not ship in the v1.11.0 public composition. The individual personal-confirmation rules and their source remain available in the old tag. The current general [assistant](/en/features/agent) does not imply these tools are included.
:::

In the current public version, fill requests on the Office pages and handle them in the existing approval center.

## Scope and acceptance checks

Meeting rooms, collaborative tasks, supplies and assets, vehicles, full HR, contracts and official documents, payments and electronic signatures are not included. A general approval form does not implement those business systems.

Automated checks and builds for basic mobile approvals do not replace acceptance on real devices. Before rollout, verify sign-in, file previews, complete decision information, handling, return and resubmit, tenant isolation, concurrent actions, SMTP and storage in your environment. DingTalk remains a separate optional integration, not implemented or enabled.

For integration, see the repository's [office documentation](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/oa.md) (Chinese) and [Workflow](/en/features/workflow).
