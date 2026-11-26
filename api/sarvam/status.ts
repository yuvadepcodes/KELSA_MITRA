interface ApiRequest {
  method?: string;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (data: unknown) => void;
}

export default function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const configured = Boolean((process.env.SARVAM_API_KEY || '').trim());
  res.status(200).json({
    configured,
    sttModel: 'saaras:v4',
    ttsModel: 'bulbul:v3',
  });
}
