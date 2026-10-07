const displayNames = {
  'llm': 'LLM', 'http api': 'HTTP API', 'starrocks': 'StarRocks',
  'bigquery': 'BigQuery', 'langgraph': 'LangGraph', 'delta lake': 'Delta Lake',
  'k8s': 'Kubernetes', 'kubernetes': 'Kubernetes', 'ci/cd': 'CI/CD',
  'mongodb': 'MongoDB', 'mysql': 'MySQL', 'postgresql': 'PostgreSQL',
  'sql': 'SQL', 'sql server': 'SQL Server', 'nosql': 'NoSQL',
  'javascript': 'JavaScript', 'typescript': 'TypeScript', 'next.js': 'Next.js',
  'node.js': 'Node.js', 'c#': 'C#', 'c++': 'C++', 'php': 'PHP', 'html': 'HTML',
  'css': 'CSS', 'aws': 'AWS', 'gcp': 'GCP', 'api': 'API', 'rest api': 'REST API',
  'nlp': 'NLP', 'scikit-learn': 'scikit-learn', 'pytorch': 'PyTorch',
  'tensorflow': 'TensorFlow', 'github': 'GitHub', 'jquery': 'jQuery',
  'power bi': 'Power BI', 'matlab': 'MATLAB', 'uavs': 'UAVs', 'fmea': 'FMEA',
  'fracas': 'FRACAS', 'cad': 'CAD', 'as9100': 'AS9100', 'do-178c': 'DO-178C',
  'do-254': 'DO-254',
};
export function skillDisplayName(skill) {
  if (skill.includes(' / ')) return skill.split(' / ').map(skillDisplayName).join(' / ');
  const key = skill.trim().toLowerCase();
  return displayNames[key] || key.replace(/\b[a-z]/g, letter => letter.toUpperCase());
}
