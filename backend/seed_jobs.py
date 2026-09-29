"""Seed jobs."""

from dotenv import load_dotenv
load_dotenv()

import db
from nlp_tagger import tag_skills_for_job

# Raw job data — 17 jobs per company

JOBS = [
    # ---- Texas Instruments ----------------------------------------
    {
        "company": "Texas Instruments",
        "title": "Software Engineer – Embedded Systems",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$85k–$115k",
        "date_posted": "2026-03-15",
        "source_url": "https://careers.ti.com/job/1001",
        "description": """
Software Engineer – Embedded Systems

Required Qualifications:
- Bachelor's degree in Computer Science, Electrical Engineering, or related field
- 2+ years of experience with C++ and Python for embedded development
- Proficiency with Linux kernel and real-time operating systems
- Experience with Git version control and CI/CD pipelines
- Strong SQL skills for test data management

Preferred Qualifications:
- Experience with Docker and containerized development environments
- Familiarity with AWS IoT services
- Knowledge of machine learning for signal processing
- Experience with MATLAB for simulation
"""
    },
    {
        "company": "Texas Instruments",
        "title": "Data Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$90k–$120k",
        "date_posted": "2026-03-20",
        "source_url": "https://careers.ti.com/job/1002",
        "description": """
Data Engineer

Required Qualifications:
- Must have 3+ years of experience with Python and SQL
- Experience with MySQL or PostgreSQL database design
- Proficiency building ETL pipelines
- Familiarity with AWS (S3, Redshift, Glue)
- Strong skills in data analysis and data visualization

Preferred Qualifications:
- Experience with machine learning workflows
- Knowledge of Tableau or Power BI is a plus
- Docker and Kubernetes experience preferred
- Familiarity with pandas and numpy
"""
    },
    {
        "company": "Texas Instruments",
        "title": "Full Stack Developer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$95k–$125k",
        "date_posted": "2026-03-18",
        "source_url": "https://careers.ti.com/job/1003",
        "description": """
Full Stack Developer

Required Qualifications:
- Minimum 2 years experience with React and Node.js
- Must have proficiency in JavaScript and TypeScript
- SQL and database design experience required
- REST API development experience essential
- Git and version control mandatory

Preferred Qualifications:
- Experience with AWS or Azure cloud platforms
- Knowledge of Docker and CI/CD is a plus
- GraphQL experience preferred
- Agile / Scrum team experience desired
"""
    },
    {
        "company": "Texas Instruments",
        "title": "Machine Learning Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$110k–$145k",
        "date_posted": "2026-03-10",
        "source_url": "https://careers.ti.com/job/1004",
        "description": """
Machine Learning Engineer

Required Qualifications:
- Bachelor's or Master's in Computer Science or related field
- 3+ years of experience with Python and machine learning
- Proficiency with TensorFlow or PyTorch required
- Experience with scikit-learn and pandas
- Strong SQL and data analysis skills

Preferred Qualifications:
- Deep learning research experience preferred
- AWS SageMaker or Azure ML experience a plus
- Docker and Kubernetes experience is a bonus
- NLP project experience desired
"""
    },
    {
        "company": "Texas Instruments",
        "title": "DevOps Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$95k–$130k",
        "date_posted": "2026-03-05",
        "source_url": "https://careers.ti.com/job/1005",
        "description": """
DevOps Engineer

Required Qualifications:
- Must have 3+ years experience with CI/CD pipelines
- Linux system administration experience required
- Docker and Kubernetes proficiency essential
- AWS or Azure cloud platform experience required
- Bash scripting and Git must have

Preferred Qualifications:
- Terraform infrastructure-as-code experience a plus
- Python scripting preferred
- Jenkins automation experience desired
- Agile process familiarity ideal
"""
    },
    {
        "company": "Texas Instruments",
        "title": "Database Administrator",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$80k–$105k",
        "date_posted": "2026-03-01",
        "source_url": "https://careers.ti.com/job/1006",
        "description": """
Database Administrator

Required Qualifications:
- SQL Server and MySQL administration experience required
- Minimum 3 years database design and optimization experience
- Must have strong SQL query tuning skills
- Linux server administration expected
- Backup and recovery procedures experience necessary

Preferred Qualifications:
- AWS RDS or Aurora experience preferred
- Python scripting for automation a plus
- NoSQL MongoDB experience desired
- Docker experience is a bonus
"""
    },
    {
        "company": "Texas Instruments",
        "title": "Backend Software Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$90k–$120k",
        "date_posted": "2026-02-28",
        "source_url": "https://careers.ti.com/job/1007",
        "description": """
Backend Software Engineer

Required Qualifications:
- Java or Python backend development experience required
- REST API and microservices architecture experience essential
- SQL database proficiency mandatory
- Git and version control required
- Linux development environment experience needed

Preferred Qualifications:
- Spring Boot experience a plus
- Docker and Kubernetes preferred
- AWS cloud services experience desired
- GraphQL knowledge is an advantage
"""
    },
    {
        "company": "Texas Instruments",
        "title": "Cloud Infrastructure Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$100k–$135k",
        "date_posted": "2026-02-20",
        "source_url": "https://careers.ti.com/job/1008",
        "description": """
Cloud Infrastructure Engineer

Required Qualifications:
- AWS or Azure cloud platform experience required (minimum 3 years)
- Docker and Kubernetes experience essential
- CI/CD pipeline management required
- Linux administration skills must have
- Terraform or infrastructure-as-code experience required

Preferred Qualifications:
- GCP experience a plus
- Python automation scripting preferred
- Bash scripting desired
- Agile team experience ideal
"""
    },
    {
        "company": "Texas Instruments",
        "title": "Frontend Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$85k–$110k",
        "date_posted": "2026-02-15",
        "source_url": "https://careers.ti.com/job/1009",
        "description": """
Frontend Engineer

Required Qualifications:
- React or Angular experience required (2+ years)
- JavaScript and TypeScript proficiency essential
- HTML and CSS must have
- Git version control required
- REST API integration experience necessary

Preferred Qualifications:
- Vue.js experience a plus
- Node.js backend familiarity preferred
- Tailwind CSS experience desired
- Agile development experience is a bonus
"""
    },
    {
        "company": "Texas Instruments",
        "title": "Systems Software Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$95k–$125k",
        "date_posted": "2026-02-10",
        "source_url": "https://careers.ti.com/job/1010",
        "description": """
Systems Software Engineer

Required Qualifications:
- C++ and Python programming experience required
- Linux kernel and OS internals knowledge necessary
- Git and collaborative development tools required
- Problem solving and communication skills expected

Preferred Qualifications:
- Rust systems programming a plus
- Docker containerization preferred
- AWS cloud experience desired
- Embedded systems experience ideal
"""
    },
    {
        "company": "Texas Instruments",
        "title": "Data Analyst",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$70k–$95k",
        "date_posted": "2026-02-05",
        "source_url": "https://careers.ti.com/job/1011",
        "description": """
Data Analyst

Required Qualifications:
- SQL and data analysis experience required (2+ years)
- Python and pandas proficiency necessary
- Data visualization skills essential
- Excel proficiency required
- Communication and teamwork skills expected

Preferred Qualifications:
- Tableau or Power BI experience preferred
- Machine learning familiarity a plus
- AWS experience desired
- R statistical analysis experience ideal
"""
    },
    {
        "company": "Texas Instruments",
        "title": "Security Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$100k–$135k",
        "date_posted": "2026-01-30",
        "source_url": "https://careers.ti.com/job/1012",
        "description": """
Security Engineer

Required Qualifications:
- Network security and application security experience required
- Linux system hardening experience essential
- Python scripting for security automation must have
- Git and secure SDLC practices required
- Problem solving skills mandatory

Preferred Qualifications:
- AWS security services experience a plus
- Docker container security preferred
- CI/CD security integration desired
- Machine learning for anomaly detection ideal
"""
    },
    {
        "company": "Texas Instruments",
        "title": "QA Automation Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$75k–$100k",
        "date_posted": "2026-01-25",
        "source_url": "https://careers.ti.com/job/1013",
        "description": """
QA Automation Engineer

Required Qualifications:
- Python or Java test automation experience required
- SQL database testing experience needed
- Git and CI/CD pipeline experience essential
- Linux environment testing required
- Communication and teamwork mandatory

Preferred Qualifications:
- Docker test environment experience a plus
- AWS testing tools preferred
- Agile Scrum experience desired
- REST API testing experience ideal
"""
    },
    {
        "company": "Texas Instruments",
        "title": "Product Software Engineer",
        "location": "Plano, TX",
        "job_type": "Full-time",
        "salary_range": "$90k–$120k",
        "date_posted": "2026-01-20",
        "source_url": "https://careers.ti.com/job/1014",
        "description": """
Product Software Engineer

Required Qualifications:
- Python and C++ development experience required
- SQL and database management experience essential
- Git version control required
- Linux proficiency needed
- Agile project management experience expected

Preferred Qualifications:
- AWS cloud experience preferred
- Docker and containerization a plus
- Machine learning prototyping desired
- React frontend experience ideal
"""
    },
    {
        "company": "Texas Instruments",
        "title": "Software Engineer Intern (Summer 2026)",
        "location": "Dallas, TX",
        "job_type": "Internship",
        "salary_range": "$30–$40/hr",
        "date_posted": "2026-03-22",
        "source_url": "https://careers.ti.com/job/1015",
        "description": """
Software Engineer Intern

Required Qualifications:
- Currently pursuing a degree in Computer Science or related field
- Python or Java programming experience required
- SQL fundamentals required
- Git version control experience needed
- Problem solving and communication skills expected

Preferred Qualifications:
- React or web development experience a plus
- Linux familiarity preferred
- Machine learning coursework desired
- Agile or project experience ideal
"""
    },
    {
        "company": "Texas Instruments",
        "title": "Data Science Intern (Summer 2026)",
        "location": "Dallas, TX",
        "job_type": "Internship",
        "salary_range": "$30–$40/hr",
        "date_posted": "2026-03-22",
        "source_url": "https://careers.ti.com/job/1016",
        "description": """
Data Science Intern

Required Qualifications:
- Pursuing Computer Science, Statistics, or related degree
- Python and pandas required
- SQL data querying required
- Machine learning coursework or project experience expected
- Communication and teamwork mandatory

Preferred Qualifications:
- TensorFlow or scikit-learn experience a plus
- Data visualization with Tableau preferred
- NumPy experience desired
- AWS cloud familiarity ideal
"""
    },
    {
        "company": "Texas Instruments",
        "title": "Technical Program Manager",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$110k–$145k",
        "date_posted": "2026-03-01",
        "source_url": "https://careers.ti.com/job/1017",
        "description": """
Technical Program Manager

Required Qualifications:
- Project management experience required (3+ years)
- Agile and Scrum methodology experience essential
- Communication and teamwork skills mandatory
- SQL reporting and data analysis required
- Git and engineering tooling familiarity necessary

Preferred Qualifications:
- AWS cloud platform familiarity preferred
- Jira project tracking experience a plus
- Python scripting for reporting desired
- Docker environment awareness ideal
"""
    },

    # ---- AT&T -------------------------------------------------------
    {
        "company": "AT&T",
        "title": "Software Engineer – Network Platform",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$90k–$120k",
        "date_posted": "2026-03-18",
        "source_url": "https://www.att.jobs/job/2001",
        "description": """
Software Engineer – Network Platform

Required Qualifications:
- Python and Java development experience required
- REST API and microservices experience essential
- SQL and database design must have
- Linux and Bash scripting required
- Git version control expected

Preferred Qualifications:
- AWS or Azure experience preferred
- Docker and Kubernetes a plus
- Node.js backend experience desired
- Agile Scrum experience ideal
"""
    },
    {
        "company": "AT&T",
        "title": "Cloud Solutions Architect",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$120k–$160k",
        "date_posted": "2026-03-15",
        "source_url": "https://www.att.jobs/job/2002",
        "description": """
Cloud Solutions Architect

Required Qualifications:
- AWS or Azure cloud architecture experience required (5+ years)
- Docker and Kubernetes mandatory
- CI/CD pipeline design experience essential
- Linux infrastructure management required
- Communication and project management skills needed

Preferred Qualifications:
- GCP experience a plus
- Terraform IaC preferred
- Python automation desired
- Machine learning services experience ideal
"""
    },
    {
        "company": "AT&T",
        "title": "Full Stack Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$95k–$130k",
        "date_posted": "2026-03-10",
        "source_url": "https://www.att.jobs/job/2003",
        "description": """
Full Stack Engineer

Required Qualifications:
- React and Node.js full stack experience required
- JavaScript and TypeScript must have
- SQL and REST API development essential
- Git version control required
- Linux development experience needed

Preferred Qualifications:
- AWS experience preferred
- GraphQL experience a plus
- Docker containerization desired
- Agile project experience ideal
"""
    },
    {
        "company": "AT&T",
        "title": "Data Platform Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$95k–$125k",
        "date_posted": "2026-03-08",
        "source_url": "https://www.att.jobs/job/2004",
        "description": """
Data Platform Engineer

Required Qualifications:
- Python and SQL required for data pipeline development
- AWS data services experience (S3, Glue, Athena) essential
- MySQL or PostgreSQL required
- Data analysis and data visualization skills necessary
- Git version control must have

Preferred Qualifications:
- Spark or distributed compute experience preferred
- Tableau or Power BI a plus
- Machine learning pipeline experience desired
- Docker environment experience ideal
"""
    },
    {
        "company": "AT&T",
        "title": "Cybersecurity Analyst",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$85k–$110k",
        "date_posted": "2026-03-05",
        "source_url": "https://www.att.jobs/job/2005",
        "description": """
Cybersecurity Analyst

Required Qualifications:
- Network security and threat analysis experience required
- Python scripting for security automation essential
- Linux system administration must have
- SQL for log analysis and reporting required
- Communication skills mandatory

Preferred Qualifications:
- AWS security tools experience preferred
- Machine learning for threat detection a plus
- Docker container security experience desired
- Agile team experience ideal
"""
    },
    {
        "company": "AT&T",
        "title": "Backend Developer – API Services",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$90k–$120k",
        "date_posted": "2026-02-28",
        "source_url": "https://www.att.jobs/job/2006",
        "description": """
Backend Developer – API Services

Required Qualifications:
- Python Flask or Django API development required
- SQL and database management experience essential
- REST API design and microservices must have
- Git and CI/CD experience required
- Linux proficiency needed

Preferred Qualifications:
- FastAPI or Spring Boot experience a plus
- Docker and Kubernetes preferred
- AWS deployment experience desired
- GraphQL experience ideal
"""
    },
    {
        "company": "AT&T",
        "title": "DevOps Automation Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$100k–$130k",
        "date_posted": "2026-02-25",
        "source_url": "https://www.att.jobs/job/2007",
        "description": """
DevOps Automation Engineer

Required Qualifications:
- CI/CD pipeline management required (Jenkins or GitHub Actions)
- Docker and Kubernetes experience essential
- Bash and Python scripting for automation must have
- Linux infrastructure administration required
- AWS or Azure experience needed

Preferred Qualifications:
- Terraform IaC experience preferred
- Agile Scrum experience a plus
- Git branch management desired
- GCP experience ideal
"""
    },
    {
        "company": "AT&T",
        "title": "Machine Learning Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$115k–$150k",
        "date_posted": "2026-02-20",
        "source_url": "https://www.att.jobs/job/2008",
        "description": """
Machine Learning Engineer

Required Qualifications:
- Python machine learning development required
- TensorFlow or PyTorch proficiency essential
- SQL and data analysis must have
- Pandas and NumPy required
- AWS SageMaker or similar ML platform experience needed

Preferred Qualifications:
- Deep learning NLP experience preferred
- Docker and Kubernetes a plus
- Data visualization skills desired
- Scikit-learn familiarity ideal
"""
    },
    {
        "company": "AT&T",
        "title": "Frontend Developer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$80k–$108k",
        "date_posted": "2026-02-18",
        "source_url": "https://www.att.jobs/job/2009",
        "description": """
Frontend Developer

Required Qualifications:
- React development experience required (2+ years)
- JavaScript and HTML/CSS must have
- REST API integration experience essential
- Git version control required
- Communication and teamwork expected

Preferred Qualifications:
- TypeScript experience preferred
- Vue or Angular a plus
- Node.js backend knowledge desired
- AWS hosting familiarity ideal
"""
    },
    {
        "company": "AT&T",
        "title": "Database Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$85k–$112k",
        "date_posted": "2026-02-15",
        "source_url": "https://www.att.jobs/job/2010",
        "description": """
Database Engineer

Required Qualifications:
- MySQL or SQL Server experience required
- SQL query optimization and schema design essential
- Python or Java scripting for DB automation must have
- Linux server experience required
- Git and documentation practices needed

Preferred Qualifications:
- AWS RDS experience preferred
- MongoDB or NoSQL experience a plus
- Docker environment familiarity desired
- Agile team experience ideal
"""
    },
    {
        "company": "AT&T",
        "title": "Software Engineering Intern",
        "location": "Dallas, TX",
        "job_type": "Internship",
        "salary_range": "$28–$38/hr",
        "date_posted": "2026-03-20",
        "source_url": "https://www.att.jobs/job/2011",
        "description": """
Software Engineering Intern

Required Qualifications:
- Pursuing Computer Science or related degree
- Python or JavaScript programming required
- SQL fundamentals must have
- Git experience needed
- Communication and teamwork expected

Preferred Qualifications:
- React or Node.js experience a plus
- AWS familiarity preferred
- Linux experience desired
- Agile coursework or project experience ideal
"""
    },
    {
        "company": "AT&T",
        "title": "Network Software Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$92k–$122k",
        "date_posted": "2026-02-10",
        "source_url": "https://www.att.jobs/job/2012",
        "description": """
Network Software Engineer

Required Qualifications:
- Python and Bash scripting for network automation required
- Linux networking and system administration essential
- SQL for operational data management must have
- Git version control expected
- Problem solving and communication skills required

Preferred Qualifications:
- Docker containerization preferred
- AWS networking experience a plus
- REST API development desired
- Agile Scrum experience ideal
"""
    },
    {
        "company": "AT&T",
        "title": "Product Manager – Digital Platforms",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$105k–$140k",
        "date_posted": "2026-02-05",
        "source_url": "https://www.att.jobs/job/2013",
        "description": """
Product Manager – Digital Platforms

Required Qualifications:
- Product management experience required (3+ years)
- Agile and Scrum methodology mandatory
- Communication and project management skills essential
- SQL and data analysis for product metrics required
- Jira or similar project tracking experience needed

Preferred Qualifications:
- AWS platform familiarity preferred
- React frontend awareness a plus
- Machine learning product experience desired
- Power BI or Tableau for reporting ideal
"""
    },
    {
        "company": "AT&T",
        "title": "Site Reliability Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$105k–$140k",
        "date_posted": "2026-01-28",
        "source_url": "https://www.att.jobs/job/2014",
        "description": """
Site Reliability Engineer

Required Qualifications:
- Linux production systems experience required
- Python and Bash automation must have
- Docker and Kubernetes essential
- AWS or Azure cloud infrastructure required
- CI/CD pipeline experience needed

Preferred Qualifications:
- Terraform IaC experience preferred
- SQL monitoring and logging experience a plus
- Machine learning for anomaly detection desired
- Git branching and code review experience ideal
"""
    },
    {
        "company": "AT&T",
        "title": "Data Analyst – Business Intelligence",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$72k–$98k",
        "date_posted": "2026-01-20",
        "source_url": "https://www.att.jobs/job/2015",
        "description": """
Data Analyst – Business Intelligence

Required Qualifications:
- SQL and data analysis experience required
- Tableau or Power BI proficiency essential
- Excel and data visualization must have
- Python for data cleaning required
- Communication skills mandatory

Preferred Qualifications:
- AWS data services experience preferred
- Machine learning for predictive analytics a plus
- R statistical analysis desired
- Agile experience ideal
"""
    },
    {
        "company": "AT&T",
        "title": "Java Backend Engineer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$92k–$122k",
        "date_posted": "2026-01-15",
        "source_url": "https://www.att.jobs/job/2016",
        "description": """
Java Backend Engineer

Required Qualifications:
- Java development required (3+ years)
- Spring Boot and REST API must have
- SQL database management essential
- Git version control required
- Linux deployment experience needed

Preferred Qualifications:
- Docker and Kubernetes preferred
- AWS Java services experience a plus
- Microservices architecture experience desired
- Python scripting familiarity ideal
"""
    },
    {
        "company": "AT&T",
        "title": "iOS / Android Mobile Developer",
        "location": "Dallas, TX",
        "job_type": "Full-time",
        "salary_range": "$95k–$130k",
        "date_posted": "2026-01-10",
        "source_url": "https://www.att.jobs/job/2017",
        "description": """
Mobile Developer

Required Qualifications:
- Swift or Kotlin mobile development required
- REST API integration essential
- SQL fundamentals must have
- Git version control required
- Communication and teamwork expected

Preferred Qualifications:
- React Native cross-platform experience a plus
- AWS mobile services preferred
- JavaScript familiarity desired
- Agile Scrum experience ideal
"""
    },

    # ---- Raytheon ---------------------------------------------------
    {
        "company": "Raytheon",
        "title": "Software Engineer – Defense Systems",
        "location": "McKinney, TX",
        "job_type": "Full-time",
        "salary_range": "$95k–$130k",
        "date_posted": "2026-03-18",
        "source_url": "https://careers.rtx.com/job/3001",
        "description": """
Software Engineer – Defense Systems

Required Qualifications:
- C++ or Java development required (3+ years)
- Linux embedded systems experience essential
- Python scripting for automation must have
- SQL database integration experience required
- Git version control expected

Preferred Qualifications:
- AWS GovCloud experience preferred
- Docker containerization a plus
- Machine learning for signal analysis desired
- Agile Scrum experience ideal
"""
    },
    {
        "company": "Raytheon",
        "title": "Embedded Software Engineer",
        "location": "McKinney, TX",
        "job_type": "Full-time",
        "salary_range": "$98k–$132k",
        "date_posted": "2026-03-15",
        "source_url": "https://careers.rtx.com/job/3002",
        "description": """
Embedded Software Engineer

Required Qualifications:
- C++ embedded systems development required
- Linux RTOS experience essential
- Python test automation must have
- Git version control required
- Problem solving skills expected

Preferred Qualifications:
- MATLAB simulation experience preferred
- Docker environment familiarity a plus
- SQL test data management desired
- Communication and teamwork ideal
"""
    },
    {
        "company": "Raytheon",
        "title": "Cybersecurity Engineer",
        "location": "McKinney, TX",
        "job_type": "Full-time",
        "salary_range": "$100k–$140k",
        "date_posted": "2026-03-10",
        "source_url": "https://careers.rtx.com/job/3003",
        "description": """
Cybersecurity Engineer

Required Qualifications:
- Network security and vulnerability assessment required
- Linux security hardening experience essential
- Python security scripting must have
- Git and documentation required
- Communication skills mandatory

Preferred Qualifications:
- AWS security services experience preferred
- Machine learning for intrusion detection a plus
- Docker container security desired
- SQL log analysis experience ideal
"""
    },
    {
        "company": "Raytheon",
        "title": "Data Engineer – Mission Analytics",
        "location": "McKinney, TX",
        "job_type": "Full-time",
        "salary_range": "$95k–$128k",
        "date_posted": "2026-03-08",
        "source_url": "https://careers.rtx.com/job/3004",
        "description": """
Data Engineer – Mission Analytics

Required Qualifications:
- Python and SQL required
- Data pipeline and ETL experience essential
- MySQL or PostgreSQL database design must have
- Data analysis and visualization skills required
- Git version control needed

Preferred Qualifications:
- AWS data services preferred
- Machine learning integration experience a plus
- Pandas and NumPy experience desired
- Tableau or Power BI ideal
"""
    },
    {
        "company": "Raytheon",
        "title": "Cloud Infrastructure Engineer",
        "location": "McKinney, TX",
        "job_type": "Full-time",
        "salary_range": "$100k–$138k",
        "date_posted": "2026-03-05",
        "source_url": "https://careers.rtx.com/job/3005",
        "description": """
Cloud Infrastructure Engineer

Required Qualifications:
- AWS or Azure cloud platform experience required
- Docker and Kubernetes essential
- CI/CD pipeline experience must have
- Linux administration required
- Git and automation scripting needed

Preferred Qualifications:
- Terraform infrastructure-as-code preferred
- Python and Bash automation a plus
- GCP familiarity desired
- Agile team experience ideal
"""
    },
    {
        "company": "Raytheon",
        "title": "Machine Learning Engineer – Signals",
        "location": "McKinney, TX",
        "job_type": "Full-time",
        "salary_range": "$115k–$155k",
        "date_posted": "2026-03-01",
        "source_url": "https://careers.rtx.com/job/3006",
        "description": """
Machine Learning Engineer – Signals

Required Qualifications:
- Python machine learning development required
- TensorFlow or PyTorch proficiency essential
- SQL and data analysis must have
- NumPy and pandas required
- Git version control expected

Preferred Qualifications:
- Deep learning experience preferred
- MATLAB signal processing a plus
- AWS SageMaker experience desired
- Docker and Kubernetes ideal
"""
    },
    {
        "company": "Raytheon",
        "title": "Full Stack Developer – Internal Tools",
        "location": "McKinney, TX",
        "job_type": "Full-time",
        "salary_range": "$90k–$120k",
        "date_posted": "2026-02-25",
        "source_url": "https://careers.rtx.com/job/3007",
        "description": """
Full Stack Developer – Internal Tools

Required Qualifications:
- React and Node.js development required
- JavaScript and TypeScript must have
- SQL and database design essential
- REST API development required
- Git version control expected

Preferred Qualifications:
- AWS deployment experience preferred
- Docker and CI/CD a plus
- Python backend scripting desired
- Agile Scrum experience ideal
"""
    },
    {
        "company": "Raytheon",
        "title": "DevOps Engineer",
        "location": "McKinney, TX",
        "job_type": "Full-time",
        "salary_range": "$100k–$135k",
        "date_posted": "2026-02-20",
        "source_url": "https://careers.rtx.com/job/3008",
        "description": """
DevOps Engineer

Required Qualifications:
- CI/CD pipeline experience required
- Docker and Kubernetes essential
- Linux administration must have
- Bash and Python automation required
- AWS or Azure experience needed

Preferred Qualifications:
- Terraform IaC preferred
- Jenkins or GitHub Actions experience a plus
- Git branch strategy experience desired
- Agile team experience ideal
"""
    },
    {
        "company": "Raytheon",
        "title": "Software QA Engineer",
        "location": "McKinney, TX",
        "job_type": "Full-time",
        "salary_range": "$78k–$105k",
        "date_posted": "2026-02-18",
        "source_url": "https://careers.rtx.com/job/3009",
        "description": """
Software QA Engineer

Required Qualifications:
- Python or Java test automation required
- SQL for test data validation essential
- Git and CI/CD integration must have
- Linux test environment experience needed
- Communication skills mandatory

Preferred Qualifications:
- Docker container testing preferred
- Agile Scrum QA experience a plus
- REST API testing desired
- AWS testing tools ideal
"""
    },
    {
        "company": "Raytheon",
        "title": "Backend Engineer – Mission Systems",
        "location": "McKinney, TX",
        "job_type": "Full-time",
        "salary_range": "$95k–$128k",
        "date_posted": "2026-02-15",
        "source_url": "https://careers.rtx.com/job/3010",
        "description": """
Backend Engineer – Mission Systems

Required Qualifications:
- Java or Python backend development required
- REST API and microservices experience essential
- SQL database management must have
- Linux deployment experience required
- Git version control expected

Preferred Qualifications:
- Spring Boot experience preferred
- Docker and Kubernetes a plus
- AWS services experience desired
- Problem solving and communication ideal
"""
    },
    {
        "company": "Raytheon",
        "title": "Software Engineering Intern (Summer 2026)",
        "location": "McKinney, TX",
        "job_type": "Internship",
        "salary_range": "$30–$42/hr",
        "date_posted": "2026-03-20",
        "source_url": "https://careers.rtx.com/job/3011",
        "description": """
Software Engineering Intern

Required Qualifications:
- Pursuing Computer Science, Electrical Engineering, or related degree
- Python or Java programming required
- SQL fundamentals needed
- Git experience required
- Problem solving and communication expected

Preferred Qualifications:
- Linux experience a plus
- C++ embedded or systems experience preferred
- AWS familiarity desired
- Machine learning coursework ideal
"""
    },
    {
        "company": "Raytheon",
        "title": "Data Scientist",
        "location": "McKinney, TX",
        "job_type": "Full-time",
        "salary_range": "$108k–$145k",
        "date_posted": "2026-02-10",
        "source_url": "https://careers.rtx.com/job/3012",
        "description": """
Data Scientist

Required Qualifications:
- Python and machine learning required
- SQL and data analysis essential
- Scikit-learn or PyTorch must have
- Data visualization proficiency required
- Communication skills expected

Preferred Qualifications:
- Deep learning NLP experience preferred
- AWS SageMaker a plus
- Pandas and NumPy experience desired
- Tableau or Power BI ideal
"""
    },
    {
        "company": "Raytheon",
        "title": "Systems Software Architect",
        "location": "McKinney, TX",
        "job_type": "Full-time",
        "salary_range": "$130k–$165k",
        "date_posted": "2026-02-05",
        "source_url": "https://careers.rtx.com/job/3013",
        "description": """
Systems Software Architect

Required Qualifications:
- Software architecture experience required (7+ years)
- C++ or Java deep expertise essential
- Linux systems design must have
- SQL and data modeling required
- Communication and project management needed

Preferred Qualifications:
- AWS cloud architecture preferred
- Docker and Kubernetes a plus
- Python scripting desired
- Agile team leadership experience ideal
"""
    },
    {
        "company": "Raytheon",
        "title": "Network Security Engineer",
        "location": "McKinney, TX",
        "job_type": "Full-time",
        "salary_range": "$100k–$135k",
        "date_posted": "2026-01-30",
        "source_url": "https://careers.rtx.com/job/3014",
        "description": """
Network Security Engineer

Required Qualifications:
- Network security architecture required
- Python automation for security must have
- Linux hardening experience essential
- SQL for compliance data required
- Git documentation practices needed

Preferred Qualifications:
- AWS security tools experience preferred
- Docker container security a plus
- Machine learning for threat detection desired
- Communication and teamwork ideal
"""
    },
    {
        "company": "Raytheon",
        "title": "Cloud Software Engineer",
        "location": "McKinney, TX",
        "job_type": "Full-time",
        "salary_range": "$100k–$135k",
        "date_posted": "2026-01-25",
        "source_url": "https://careers.rtx.com/job/3015",
        "description": """
Cloud Software Engineer

Required Qualifications:
- AWS cloud development required
- Python and Docker essential
- CI/CD pipeline experience must have
- Linux experience required
- Git version control needed

Preferred Qualifications:
- Kubernetes orchestration preferred
- Terraform IaC a plus
- REST API development desired
- Agile team experience ideal
"""
    },
    {
        "company": "Raytheon",
        "title": "Database Developer",
        "location": "McKinney, TX",
        "job_type": "Full-time",
        "salary_range": "$82k–$110k",
        "date_posted": "2026-01-20",
        "source_url": "https://careers.rtx.com/job/3016",
        "description": """
Database Developer

Required Qualifications:
- MySQL or SQL Server development required
- SQL query optimization essential
- Python scripting for data automation must have
- Linux server experience required
- Git documentation practices needed

Preferred Qualifications:
- AWS RDS or Aurora experience preferred
- MongoDB or NoSQL experience a plus
- Docker familiarity desired
- Data visualization skills ideal
"""
    },
    {
        "company": "Raytheon",
        "title": "Software Integration Engineer",
        "location": "McKinney, TX",
        "job_type": "Full-time",
        "salary_range": "$92k–$125k",
        "date_posted": "2026-01-15",
        "source_url": "https://careers.rtx.com/job/3017",
        "description": """
Software Integration Engineer

Required Qualifications:
- Python and Java integration development required
- REST API and microservices experience essential
- SQL database management must have
- Linux and Bash scripting required
- Git and CI/CD experience needed

Preferred Qualifications:
- Docker and Kubernetes preferred
- AWS services experience a plus
- Agile Scrum experience desired
- Communication and problem solving ideal
"""
    },
]


def run_seed():
    print("[seed] Starting seed...")
    pass
    pass

    # Get company IDs
    company_ids = {}
    for name in ["Texas Instruments", "AT&T", "Raytheon"]:
        cid = db.insert_company(name)
        if cid:
            company_ids[name] = cid
            print(f"[seed] Company '{name}' -> id={cid}")

    inserted = 0
    for job in JOBS:
        cid = company_ids.get(job["company"])
        if not cid:
            print(f"[seed] Skipping job — no company id for {job['company']}")
            continue

        job_id = db.insert_job(
            company_id   = cid,
            title        = job["title"],
            source_url   = job["source_url"],
            description  = job["description"].strip(),
            location     = job["location"],
            job_type     = job["job_type"],
            salary_range = job["salary_range"],
            date_posted  = job["date_posted"],
        )

        if not job_id:
            print(f"[seed] Skipped duplicate: {job['title']}")
            continue

        # NLP tag skills
        tagged = tag_skills_for_job(job["description"])
        for item in tagged:
            skill_id = db.insert_skill(item["skill_name"])
            if skill_id:
                db.link_job_skill(job_id, skill_id, item["requirement_type"])

        inserted += 1
        print(f"[seed] Inserted job {job_id}: {job['title']} ({len(tagged)} skills tagged)")

    print(f"\n[seed] Done. {inserted} jobs inserted.")

    # Also pre-populate User_Skills for the test user
    test_user = db.get_user_by_email("student@test.com")
    if test_user:
        uid = test_user["user_id"]
        for skill_name in ["Python", "SQL", "React", "Git", "JavaScript"]:
            sid = db.insert_skill(skill_name)
            if sid:
                db.add_user_skill(uid, sid)
        print("[seed] Test user skills populated.")

    print("\n[seed] All done! Database is ready for MVP demo.")


if __name__ == "__main__":
    run_seed()
