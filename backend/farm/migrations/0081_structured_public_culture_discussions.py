from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def group_legacy_comments(apps, schema_editor):
    Comment = apps.get_model('farm', 'PublicCultureDiscussionComment')
    Topic = apps.get_model('farm', 'PublicCultureDiscussionTopic')
    culture_ids = Comment.objects.order_by().values_list('public_culture_id', flat=True).distinct()
    for culture_id in culture_ids:
        comments = list(Comment.objects.filter(public_culture_id=culture_id).order_by('created_at', 'id'))
        if not comments:
            continue
        first = comments[0]
        topic = Topic.objects.create(
            public_culture_id=culture_id,
            title='Allgemeine Diskussion',
            created_by_id=first.created_by_id,
        )
        Topic.objects.filter(pk=topic.pk).update(created_at=first.created_at)
        Comment.objects.filter(pk__in=[comment.pk for comment in comments]).update(topic_id=topic.pk)


class Migration(migrations.Migration):
    dependencies = [('farm', '0080_publicculturerevision')]

    operations = [
        migrations.CreateModel(
            name='PublicCultureDiscussionTopic',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=240)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='public_culture_discussion_topics', to=settings.AUTH_USER_MODEL)),
                ('public_culture', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='discussion_topics', to='farm.publicculture')),
                ('revision', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='discussion_topics', to='farm.publicculturerevision')),
            ],
            options={'ordering': ['-created_at', '-id']},
        ),
        migrations.AddField(
            model_name='publicculturediscussioncomment',
            name='topic',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='comments', to='farm.publicculturediscussiontopic'),
        ),
        migrations.AddField(
            model_name='publicculturediscussioncomment',
            name='parent',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='replies', to='farm.publicculturediscussioncomment'),
        ),
        migrations.AddField(
            model_name='publicculturediscussioncomment',
            name='edited_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='publicculturediscussioncomment',
            name='deleted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='publicculturediscussioncomment',
            name='deleted_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='deleted_public_culture_discussion_comments', to=settings.AUTH_USER_MODEL),
        ),
        migrations.RunPython(group_legacy_comments, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='publicculturediscussioncomment',
            name='topic',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='comments', to='farm.publicculturediscussiontopic'),
        ),
        migrations.RemoveField(model_name='publicculturediscussioncomment', name='public_culture'),
    ]
