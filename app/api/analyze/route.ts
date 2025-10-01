import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * API Route: POST /api/analyze
 *
 * Proxies audio analysis requests to the Python service
 * This allows the frontend to communicate with the Python service through Next.js
 */
export async function POST(request: NextRequest) {
  try {
    // Get the form data from the request
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Forward the request to the Python service
    const pythonFormData = new FormData();
    pythonFormData.append('file', file);

    const response = await fetch(`${PYTHON_SERVICE_URL}/analyze`, {
      method: 'POST',
      body: pythonFormData,
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { success: false, error: error.detail || 'Analysis failed' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Analysis API error:', error);

    // Check if Python service is not running
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Speech analysis service is not running. Please start the Python service.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * API Route: GET /api/analyze
 *
 * Health check for the analysis service
 */
export async function GET() {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/health`, {
      method: 'GET',
    });

    if (!response.ok) {
      return NextResponse.json(
        { status: 'unhealthy', error: 'Python service not responding' },
        { status: 503 }
      );
    }

    const data = await response.json();

    return NextResponse.json(
      {
        status: 'healthy',
        pythonService: data,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { status: 'unhealthy', error: 'Cannot connect to Python service' },
      { status: 503 }
    );
  }
}
