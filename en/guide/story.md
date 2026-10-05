# Project story

On this page I want to talk about why I built Qiwu, who I hope will use it, and why I chose to open-source it.

## Why I built it

The first reason: there was no open-source Node admin framework that I found good to use. I wanted to write business code directly on top of one. To me, "good to use" means complete features, secure defaults, tests and detailed docs, so that I can confidently use it for real projects.

The common features had to be there: users, roles, menus, departments, dictionaries, parameters, logs, scheduled tasks, messaging, files and code generation. Approval workflows needed both a tree designer and a BPMN designer, with no-code approvals; a form designer, internationalization, OAuth2-based single sign-on and a mobile app were all a must. In Java admin templates like RuoYi and Yudao these have long been standard, but on the Node side it is hard to find them all in one place.

Security should be there by default. Any request for a record outside the allowed data scope returns 404, without revealing whether the record exists. A privilege escalation guard stops you from granting others permissions you do not have; duplicate-submit guards stop the same action from running twice. Secrets should be stored encrypted, and uploaded files should be identified by their content. I wanted these protections, the tests and the detailed docs to be ready out of the box, with nothing left to fill in, so you can use it with confidence right away.

The second reason: for small projects, Node actually costs less than Java. I mainly look at three costs.

First, people. With TypeScript on both the frontend and the backend, one person can build both sides. Validation rules and types are shared, so you do not write them twice.

Next, servers. A Node service usually uses less memory than a Java service. For a small project one cheap server is enough, which makes getting started less of a burden.

Last, development speed. It starts fast and changes take effect right away, so you see results sooner while writing business code. Deployment is one Node process plus Nginx, which keeps delivering small projects simple.

## Who it is for

I hope frontend developers who want to go full-stack can use it. If you know Vue and TypeScript, you can carry on and write the backend, building both ends without learning Java. You can start with the [Backend primer for frontend developers](/backend/) (Chinese).

Students and beginners can read the [Beginner tutorial](/beginner/) (Chinese). Developers coming from Java and RuoYi can first read the [Guide for Java developers](/java/) (Chinese) to match up the features and concepts they already know.

For small full-stack teams, agencies and indie developers, I hope you can build on Qiwu, deliver a complete admin console from one repository, and spend your time on your project's own business.

## Why open source

I open-sourced Qiwu so that more people can use it and improve it together. I chose MIT because it is one of the most permissive open-source licenses and is safe to use in commercial projects. If you run into problems or have ideas while using it, you are welcome to share them.

Next, read the [Introduction](/en/guide/introduction) to learn about the project, or follow [Getting started](/en/guide/getting-started) to get it running.
