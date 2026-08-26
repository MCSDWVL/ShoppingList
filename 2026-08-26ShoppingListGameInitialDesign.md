# Shopping List Game
Shopping list game is a single page, daily, static web game that asks users to remember what was on a list.

Users are shown a list of 5 randomly selected food items by name, and given a countdown timer to remember
the list.

After the timer expires, users are one by one shown a series of 10 images of products and asked to remember
if they were on the list or not.

After time expires or the whole list is processed, users are given a score.

We should pull the food item names + images from open data sets. Maybe the Open Food Facts API?

The implementation should be a static html page with a daily seed refreshing at midnight pacific time,
with an option to override the seed in the url for testing. It should be serveable as a github.io page.
