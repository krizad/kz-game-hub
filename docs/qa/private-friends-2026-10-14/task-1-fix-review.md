# Task 1 fix review

Range `9acd4e9b..3c586601`. Reviewer `private_room_policy_review_retry` approved both fixes, with no new Critical/Important issue. Seat admission now requires a valid token and matching name through the same identity check as joinRoom; real-service tests reject a changed-name attempt without creating a viewer. Denied spectate requests restore only the prior spectator flag and preserve current room/player/reconnect token, covered by the browser room-A/room-B scenario.

Focused API 162/162 and browser 7/7 are implementer test evidence; reviewer inspected the fix diff without repeating those tests.
