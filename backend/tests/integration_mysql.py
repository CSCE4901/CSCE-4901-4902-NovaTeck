"""Integration mysql."""
import io
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mysql.connector
import db
import app as api
import migrate
from test_resume_workflow import pdf_bytes


def main():
    name = 'novateck_test_' + uuid.uuid4().hex[:12]
    config = dict(db.DB_CONFIG)
    config.pop('database')
    connection = mysql.connector.connect(**config)
    cursor = connection.cursor()
    try:
        cursor.execute(f'CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
        cursor.execute(f'USE `{name}`')
        schema = (Path(__file__).resolve().parents[2] / 'database/novatek_schema_v2.sql').read_text()
        for statement in migrate.statements(schema):
            if statement.upper().startswith(('CREATE DATABASE', 'USE ')):
                continue
            cursor.execute(statement)
        connection.commit()
        db.DB_CONFIG['database'] = name
        migrate.main(); migrate.main()
        api.JWT_SECRET = 'integration-test-only-' + uuid.uuid4().hex
        client = api.app.test_client()
        response = client.post('/api/auth/register', json={'name': 'Test Student', 'email': 'student@example.test', 'password': 'ExamplePass12'})
        assert response.status_code == 201, response.json
        user = response.json['user_id']; headers = {'Authorization': 'Bearer ' + response.json['token']}
        for skill in ['python', 'react', 'aws', 'mysql']:
            db.insert_skill(skill)
        company = db.insert_company('Test Company')
        job = db.insert_job(company, 'Software Engineer', 'https://example.test/job', description='Python SQL')
        for skill in ['python', 'sql']:
            db.link_job_skill(job, db.insert_skill(skill))
        db.set_user_skills_from_list(user, ['python'])
        profile_path = f'/api/students/{user}/profile-details'
        assert client.put(profile_path, headers=headers, json={'name': 'Test Student', 'email': 'student@example.test', 'details': {'phone': '555-1234', 'work_types': ['Contract'], 'experience': [{'company': 'Example', 'start': '2020-01-01'}]}}).status_code == 200
        assert client.get(profile_path, headers=headers).json['phone'] == '555-1234'
        assert client.get(f'/api/students/{user + 1}/profile-details', headers=headers).status_code == 403
        assert client.put(profile_path, headers=headers, json={'name': 'Test', 'email': 'student@example.test', 'details': {'experience': [{'start': '2024-01-01', 'end': '2020-01-01'}]}}).status_code == 400
        applications_path = f'/api/students/{user}/applications'
        recommendations = db.get_recommendations(user)
        assert [row['job_id'] for row in recommendations] == [job], recommendations
        assert client.post(applications_path, headers=headers, json={'job_id': job, 'status': 'Applied'}).status_code == 200
        recommendations = db.get_recommendations(user)
        assert recommendations == [], recommendations
        assert client.get(applications_path, headers=headers).json[0]['status'] == 'Applied'
        assert client.post(applications_path, headers=headers, json={'job_id': job, 'status': 'Fake'}).status_code == 400
        assert client.get('/api/admin/overview', headers=headers).status_code == 403
        assert db.get_job_count(work_type='Contract') == 0
        before = db.get_skill_gap(user, job)
        assert before['resume_match_source'] == 'profile'
        profile_before_upload = set(db.get_user_skills(user))
        market_before_upload = db.get_student_skill_gap_summary(user)['overall_match_pct']
        assert db.get_job_count(q='Software') == 1
        assert db.get_job_count(q='no-such-title') == 0
        db.generate_skill_trend_snapshot()
        assert db.get_market_trends()
        assert client.get('/api/students/'+str(user)+'/recommendations', headers=headers).status_code == 200
        assert client.get('/api/market-trends', headers=headers).status_code == 200
        for expected in [4, 0]:
            response = client.post('/api/resume/upload', headers=headers, data={'resume': (io.BytesIO(pdf_bytes()), 'resume.pdf')})
            assert response.status_code == 200, response.json
            assert response.json['flagged_count'] == expected, response.json
        flags = db.get_flagged_skills(user)
        assert {row['skill_name'] for row in flags} == {'aws', 'mysql', 'react', 'rust'}, flags
        resume_baseline = db.get_skill_gap(user, job)
        assert resume_baseline['resume_match_source'] == 'resume'
        assert set(db.get_user_skills(user)) == profile_before_upload
        assert db.get_student_skill_gap_summary(user)['overall_match_pct'] == market_before_upload
        assert resume_baseline['match_pct'] == before['match_pct']
        assert client.get('/api/admin/flagged-skills', headers=headers).status_code == 403
        cursor.execute("UPDATE Users SET role = 'admin' WHERE user_id = %s", (user,)); connection.commit()
        assert client.get('/api/admin/overview', headers=headers).json['counts']['registered_users'] >= 1
        for pending in flags:
            assert client.post('/api/admin/approve-skill/'+str(pending['unmatched_id']), headers=headers).status_code == 200
        assert not db.get_flagged_skills(user)
        cursor.execute("SELECT skill_id FROM Skills WHERE skill_name = 'rust'"); assert cursor.fetchone()
        assert db.get_skill_gap(user, job) == resume_baseline
        assert db.flag_resume_skills(user, ['new-test-skill']) == 1
        flag = db.get_flagged_skills(user)[0]
        assert client.post('/api/admin/reject-skill/'+str(flag['unmatched_id']), headers=headers).status_code == 200
        cursor.execute("SELECT skill_id FROM Skills WHERE skill_name = 'new-test-skill'"); assert not cursor.fetchone()
        # A catalog skill missing from the profile must still be flagged.
        assert db.flag_resume_skills(user, ['  ReAcT ', 'python', 'react']) == 1
        assert [row['skill_name'] for row in db.get_flagged_skills(user)] == ['react']
        assert db.flag_resume_skills(user, ['react']) == 0
        assert [skill.lower() for skill in db.get_user_skills(user)] == ['python']
        assert db.get_skill_gap(user, job) == resume_baseline
        flag_id = db.get_flagged_skills(user)[0]['unmatched_id']
        assert not db.add_resume_skill_to_profile(user + 1, flag_id)
        add_path = f'/api/resume/skills/{flag_id}/add'
        assert client.post(add_path).status_code == 401
        assert client.post(add_path, headers=headers).status_code == 200
        assert client.post(add_path, headers=headers).status_code == 200
        assert {s.lower() for s in db.get_user_skills(user)} == {'python', 'react'}
        assert not db.get_flagged_skills(user)
        assert db.flag_resume_skills(user, ['react']) == 0
        assert db.flag_resume_skills(user, ['sql']) == 1
        sql_flag = db.get_flagged_skills(user)[0]['unmatched_id']
        assert db.add_resume_skill_to_profile(user, sql_flag)
        assert 'sql' in {skill.lower() for skill in db.get_user_skills(user)}
        # Profile additions do not rewrite the uploaded resume.
        assert db.get_skill_gap(user, job) == resume_baseline
        mechanical_job = db.insert_job(company, 'Mechanical Engineer', 'https://example.test/mechanical')
        aerospace_job = db.insert_job(company, 'Aerospace Engineer', 'https://example.test/aerospace')
        db.link_job_skill(mechanical_job, db.insert_skill('thermodynamics'))
        db.link_job_skill(aerospace_job, db.insert_skill('aerodynamics'))
        for category, expected_skill in [('mechanical', 'thermodynamics'), ('aerospace', 'aerodynamics')]:
            response = client.get(f'/api/students/{user}/skill-gap?discipline={category}', headers=headers)
            assert response.status_code == 200
            assert [row['skill_name'] for row in response.json['missing_skills']] == [expected_skill]
        assert client.get('/api/resume/saved', headers=headers).json['filename'] == 'resume.pdf'
        stored = client.get('/api/resume/saved/file', headers=headers)
        assert stored.status_code == 200 and stored.data == pdf_bytes()
        assert stored.headers['Cache-Control'] == 'no-store'
        assert client.get('/api/resume/saved/file').status_code == 401
        other = client.post('/api/auth/register', json={'name': 'Other', 'email': 'other@example.test', 'password': 'ExamplePass12'}).json
        other_headers = {'Authorization': 'Bearer ' + other['token']}
        assert client.get('/api/resume/saved', headers=other_headers).json is None
        assert client.get('/api/resume/saved/file', headers=other_headers).status_code == 404
        assert client.post('/api/resume/saved/scan', headers=other_headers).status_code == 404
        assert client.post('/api/resume/saved/scan', headers=headers).status_code == 200
        response = client.post('/api/resume/upload', headers=headers, data={'resume': (io.BytesIO(b'invalid'), 'bad.pdf')})
        assert response.status_code == 400
        assert client.get('/api/resume/saved/file', headers=headers).data == pdf_bytes()
        replacement = pdf_bytes('Python SQL')
        assert client.post('/api/resume/upload', headers=headers, data={'resume': (io.BytesIO(replacement), 'replacement.pdf')}).status_code == 200
        assert client.get('/api/resume/saved', headers=headers).json['filename'] == 'replacement.pdf'
        assert client.get('/api/resume/saved/file', headers=headers).data == replacement
        html_id, _ = db.upsert_job(company, 'Structured Engineer', 'https://example.test/structured', provider='integration', description='Fallback text', description_html='<h2>Actual employer heading</h2><ul><li>Python</li></ul><script>bad()</script>')
        structured = db.get_job_by_id(html_id)
        assert structured['description_fetched_at'] is not None
        assert structured['description_sections'][0]['title'] == 'Actual employer heading'
        assert '<script>' not in structured['description_html']
        assert '<li>Python</li>' in structured['description_sections'][0]['html']
        # Tracking parameters must not create multiple records for one source job.
        tracking_url = 'https://example.test/tracking-job?id=42'
        first_id, _ = db.upsert_job(company, 'Tracking Engineer', tracking_url + '&utm_source=email',
                                    provider='integration', closing_date='2000-01-01')
        second_id, _ = db.upsert_job(company, 'Tracking Engineer', tracking_url + '&utm_source=social',
                                     provider='integration', closing_date='2000-01-01')
        assert first_id is not None and first_id == second_id
        assert db.get_job_by_id(first_id)['source_url'] == tracking_url
        assert db.get_job_count(q='Tracking Engineer') == 0
        assert db.get_jobs(q='Tracking Engineer') == []
        # Bulk addition is owner-scoped and atomic; dismissal never removes profile/resume skills.
        impact_id, _ = db.upsert_job(company, 'Impact Engineer', 'https://example.test/impact', provider='integration', description='SQL and Docker or Kubernetes', description_html='<h2>Requirements</h2><ul><li>SQL</li><li>Docker or Kubernetes</li></ul>')
        db.replace_job_skills(impact_id, [{'skill_name': value, 'requirement_type': 'required'} for value in ['sql', 'docker', 'kubernetes']])
        assert db.flag_resume_skills(user, ['docker', 'kubernetes']) == 2
        pending = {row['skill_name']: row['unmatched_id'] for row in db.get_flagged_skills(user)}
        batch = [pending['docker'], pending['kubernetes']]
        assert db.flag_resume_skills(other['user_id'], ['docker']) == 1
        foreign = db.get_flagged_skills(other['user_id'])[0]['unmatched_id']
        profile_before = set(db.get_user_skills(user))
        market_before_add = db.get_student_skill_gap_summary(user)['overall_match_pct']
        saved_resume_match_before_add = db.get_skill_gap(user, impact_id)
        assert client.post('/api/resume/skills/add', headers=headers, json={'flag_ids': [batch[0], foreign]}).status_code == 404
        assert set(db.get_user_skills(user)) == profile_before
        assert client.post('/api/resume/skills/add', headers=headers, json={'flag_ids': [True]}).status_code == 400
        impact = client.post('/api/resume/skills/impact', headers=headers, json={'flag_ids': batch, 'discipline': ''})
        assert impact.status_code == 200, impact.json
        assert impact.json['projected_average'] > impact.json['current_average'], impact.json
        assert impact.json['current_market_match'] == market_before_add, impact.json
        assert impact.json['projected_market_match'] > market_before_add, impact.json
        assert impact.json['has_saved_resume'] is True
        assert impact.json['skill_job_counts'][str(batch[0])] >= 1
        assert client.delete(f'/api/resume/skills/{batch[0]}', headers=headers).status_code == 200
        assert set(db.get_user_skills(user)) == profile_before
        assert client.post(f'/api/resume/skills/{batch[0]}/restore', headers=other_headers).status_code == 404
        assert client.post(f'/api/resume/skills/{batch[0]}/restore', headers=headers).status_code == 200
        result = client.post('/api/resume/skills/add', headers=headers, json={'flag_ids': batch})
        assert result.status_code == 200, result.json
        market_after_add = db.get_student_skill_gap_summary(user)['overall_match_pct']
        assert market_after_add == impact.json['projected_market_match'], (market_after_add, impact.json)
        assert market_after_add > market_before_add
        assert db.get_skill_gap(user, impact_id) == saved_resume_match_before_add
        print(f'PASS: explicit Add refreshes Market skill match {market_before_add}% -> {market_after_add}%; saved-resume job match remains unchanged')
        assert {'docker', 'kubernetes'} <= {value.lower() for value in db.get_user_skills(user)}
        assert profile_before <= set(db.get_user_skills(user))
        assert not {row['unmatched_id'] for row in db.get_flagged_skills(user)} & set(batch)
        assert client.get('/api/resume/saved/file', headers=headers).data == replacement
        print('PASS: fresh schema, repeated migrations, registration, real PDF upload, duplicate prevention, owner/admin access, approve/reject, profile persistence, application statuses, admin overview, unchanged skill-gap results')
    finally:
        cursor.execute(f'DROP DATABASE IF EXISTS `{name}`')
        connection.close()


if __name__ == '__main__': main()
