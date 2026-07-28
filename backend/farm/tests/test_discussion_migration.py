from datetime import timedelta

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class StructuredDiscussionMigrationTest(TransactionTestCase):
    migrate_from = [('farm', '0080_publicculturerevision')]
    migrate_to = [('farm', '0081_structured_public_culture_discussions')]

    def setUp(self) -> None:
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps
        User = old_apps.get_model('auth', 'User')
        PublicCulture = old_apps.get_model('farm', 'PublicCulture')
        Comment = old_apps.get_model('farm', 'PublicCultureDiscussionComment')
        author = User.objects.create(username='legacy-author')
        culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published')
        first = Comment.objects.create(public_culture=culture, created_by=author, body='First legacy comment')
        second = Comment.objects.create(public_culture=culture, created_by=author, body='Second legacy comment')
        self.first_time = timezone.now() - timedelta(days=2)
        self.second_time = timezone.now() - timedelta(days=1)
        Comment.objects.filter(pk=first.pk).update(created_at=self.first_time)
        Comment.objects.filter(pk=second.pk).update(created_at=self.second_time)
        self.author_id = author.id

        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_to)
        self.apps = executor.loader.project_state(self.migrate_to).apps

    def tearDown(self) -> None:
        MigrationExecutor(connection).migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())
        super().tearDown()

    def test_legacy_comments_are_grouped_without_losing_attribution_or_order(self) -> None:
        Topic = self.apps.get_model('farm', 'PublicCultureDiscussionTopic')
        Comment = self.apps.get_model('farm', 'PublicCultureDiscussionComment')
        topic = Topic.objects.get()
        comments = list(Comment.objects.filter(topic=topic).order_by('created_at', 'id'))
        self.assertEqual(topic.title, 'Allgemeine Diskussion')
        self.assertEqual([comment.body for comment in comments], ['First legacy comment', 'Second legacy comment'])
        self.assertEqual([comment.created_by_id for comment in comments], [self.author_id, self.author_id])
        self.assertEqual(comments[0].created_at, self.first_time)
        self.assertEqual(comments[1].created_at, self.second_time)
