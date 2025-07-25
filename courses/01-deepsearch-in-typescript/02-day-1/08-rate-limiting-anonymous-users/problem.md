---
id: lesson-vc3fs
---

Rate limiting users who have logged in is pretty simple. You track the requests against their email address, and then limit them once they've hit the limit.

But what about users who are not logged in?

If we give users who are not logged in a free trial, it gives them a frictionless way to test our service.

However, it opens us up to several new vectors of attack.

- IP Address Switching, where a user switches their IP address to avoid rate limiting.
- Bots, where a user uses a bot to make requests to our service.

These are non-trivial problems that a lot of engineering effort goes into solving.

##
